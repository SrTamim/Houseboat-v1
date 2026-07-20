import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { newId } from '../common/uuid';

/** Resize/compress ceiling — gallery images never need more than this. */
const MAX_EDGE = 1600;
const WEBP_QUALITY = 80;

/** Accepted YouTube URL shapes → the canonical watch id. */
const YT_PATTERNS = [
  /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
  /(?:youtu\.be\/)([\w-]{11})/,
  /(?:youtube\.com\/embed\/)([\w-]{11})/,
  /(?:youtube\.com\/shorts\/)([\w-]{11})/,
];

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /** Ensure a cabin belongs to this boat before attaching media to it. */
  private async assertCabinInBoat(
    cabinId: string,
    houseboatId: string,
  ): Promise<void> {
    const cabin = await this.prisma.houseboatCabin.findUnique({
      where: { id: cabinId },
      select: { deck: { select: { houseboatId: true } } },
    });
    if (!cabin) throw new NotFoundException('Cabin not found');
    if (cabin.deck.houseboatId !== houseboatId) {
      throw new BadRequestException('Cabin does not belong to this houseboat');
    }
  }

  /** Normalize any accepted YouTube URL to a canonical watch URL. */
  private canonicalYoutube(url: string): string {
    for (const re of YT_PATTERNS) {
      const m = url.match(re);
      if (m) return `https://www.youtube.com/watch?v=${m[1]}`;
    }
    throw new BadRequestException('Not a recognized YouTube URL');
  }

  /** List a boat's media (optionally a single cabin's), ordered for display. */
  async list(houseboatId: string, cabinId?: string) {
    const rows = await this.prisma.houseboatMedia.findMany({
      where: { houseboatId, ...(cabinId ? { cabinId } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => ({
      ...r,
      url: r.storageKey ? this.storage.publicUrl(r.storageKey) : r.youtubeUrl,
    }));
  }

  /**
   * Upload an image: resize+compress with sharp (→ WebP, max 1600px edge,
   * stripped metadata) then store the result in R2. Bytes pass through the API
   * so we control the output — the browser can't put arbitrary objects.
   */
  async uploadImage(
    houseboatId: string,
    actorId: string,
    input: { cabinId?: string; buffer: Buffer; sortOrder?: number },
  ) {
    if (input.cabinId) await this.assertCabinInBoat(input.cabinId, houseboatId);

    let processed: Buffer;
    try {
      processed = await sharp(input.buffer)
        .rotate() // honor EXIF orientation before stripping metadata
        .resize(MAX_EDGE, MAX_EDGE, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    } catch {
      throw new BadRequestException('Invalid or unsupported image file');
    }

    const scope = input.cabinId ? `cabins/${input.cabinId}` : 'boat';
    const key = `houseboats/${houseboatId}/${scope}/${newId()}.webp`;
    await this.storage.putObject({
      key,
      body: processed,
      contentType: 'image/webp',
    });

    const row = await this.prisma.houseboatMedia.create({
      data: {
        id: newId(),
        houseboatId,
        cabinId: input.cabinId,
        kind: 'image',
        storageKey: key,
        sortOrder: input.sortOrder ?? 0,
        uploadedBy: actorId,
      },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'media_add_image',
      entityType: 'houseboat_media',
      entityId: row.id,
    });
    return { ...row, url: this.storage.publicUrl(key) };
  }

  /** Add a YouTube video to a boat/cabin gallery. */
  async createVideo(
    houseboatId: string,
    actorId: string,
    input: { cabinId?: string; youtubeUrl: string; sortOrder?: number },
  ) {
    if (input.cabinId) await this.assertCabinInBoat(input.cabinId, houseboatId);
    const youtubeUrl = this.canonicalYoutube(input.youtubeUrl);
    const row = await this.prisma.houseboatMedia.create({
      data: {
        id: newId(),
        houseboatId,
        cabinId: input.cabinId,
        kind: 'video',
        youtubeUrl,
        sortOrder: input.sortOrder ?? 0,
        uploadedBy: actorId,
      },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'media_add_video',
      entityType: 'houseboat_media',
      entityId: row.id,
    });
    return row;
  }

  /** Delete a media item (and its R2 object if it's an image). */
  async remove(houseboatId: string, actorId: string, mediaId: string) {
    const row = await this.prisma.houseboatMedia.findUnique({
      where: { id: mediaId },
    });
    if (!row || row.houseboatId !== houseboatId) {
      throw new NotFoundException('Media not found');
    }
    if (row.storageKey) {
      await this.storage.delete(row.storageKey).catch(() => undefined);
    }
    await this.prisma.houseboatMedia.delete({ where: { id: mediaId } });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'media_remove',
      entityType: 'houseboat_media',
      entityId: mediaId,
    });
    return { ok: true };
  }
}
