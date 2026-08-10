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
import { resolveVideoUrl } from './video-providers';

/** Resize/compress ceiling — gallery images never need more than this. */
const MAX_EDGE = 1600;
/** Square edge for the boat logo (cover-cropped, shown as a circle in the UI). */
const LOGO_EDGE = 512;
const WEBP_QUALITY = 80;

/** Per-gallery count caps (mirrored in the owner-console UI). */
const MAX_BOAT_IMAGES = 12;
const MAX_CABIN_IMAGES = 6;
const MAX_VIDEOS = 5; // per gallery, boat and cabin alike

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

  /** List a boat's media (optionally a single cabin's), ordered for display. */
  async list(houseboatId: string, cabinId?: string) {
    const rows = await this.prisma.houseboatMedia.findMany({
      where: { houseboatId, ...(cabinId ? { cabinId } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => {
      // For videos, re-resolve the stored canonical URL so the embed URL is
      // derived fresh from the allowlist — never persisted, never trusted raw.
      const resolved = r.videoUrl ? resolveVideoUrl(r.videoUrl) : null;
      return {
        ...r,
        url: r.storageKey ? this.storage.publicUrl(r.storageKey) : r.videoUrl,
        embedUrl: resolved?.embedUrl ?? null,
      };
    });
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

    // Enforce the per-gallery cap before spending CPU on compression. The
    // frontend hides the add control at the cap; this is the backstop.
    const cap = input.cabinId ? MAX_CABIN_IMAGES : MAX_BOAT_IMAGES;
    const existing = await this.prisma.houseboatMedia.count({
      where: {
        houseboatId,
        cabinId: input.cabinId ?? null,
        kind: 'image',
      },
    });
    if (existing >= cap) {
      throw new BadRequestException(
        `This gallery already has the maximum of ${cap} images`,
      );
    }

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

  /**
   * Add a video link to a boat/cabin gallery. The URL must match an allowlisted
   * provider (YouTube/Vimeo/Google Drive/Facebook/Instagram); we store only the
   * canonical form rebuilt server-side, never the raw input.
   */
  async createVideo(
    houseboatId: string,
    actorId: string,
    input: { cabinId?: string; videoUrl: string; sortOrder?: number },
  ) {
    if (input.cabinId) await this.assertCabinInBoat(input.cabinId, houseboatId);

    const resolved = resolveVideoUrl(input.videoUrl);
    if (!resolved) {
      throw new BadRequestException(
        'Link is not a supported video (YouTube, Vimeo, Google Drive, Facebook or Instagram)',
      );
    }

    const existing = await this.prisma.houseboatMedia.count({
      where: {
        houseboatId,
        cabinId: input.cabinId ?? null,
        kind: 'video',
      },
    });
    if (existing >= MAX_VIDEOS) {
      throw new BadRequestException(
        `This gallery already has the maximum of ${MAX_VIDEOS} videos`,
      );
    }

    const row = await this.prisma.houseboatMedia.create({
      data: {
        id: newId(),
        houseboatId,
        cabinId: input.cabinId,
        kind: 'video',
        videoUrl: resolved.canonicalUrl,
        videoProvider: resolved.provider,
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
    return { ...row, embedUrl: resolved.embedUrl };
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

  /**
   * Upload the boat logo: a single square (512×512) WebP stored on the
   * `Houseboat.logoStorageKey` column — not a gallery row. Re-uploading
   * replaces the previous logo and deletes its R2 object.
   */
  async uploadLogo(houseboatId: string, actorId: string, buffer: Buffer) {
    const boat = await this.prisma.houseboat.findUnique({
      where: { id: houseboatId },
      select: { logoStorageKey: true },
    });
    if (!boat) throw new NotFoundException('Houseboat not found');

    let processed: Buffer;
    try {
      processed = await sharp(buffer)
        .rotate() // honor EXIF orientation before stripping metadata
        .resize(LOGO_EDGE, LOGO_EDGE, { fit: 'cover', position: 'centre' })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    } catch {
      throw new BadRequestException('Invalid or unsupported image file');
    }

    const key = `houseboats/${houseboatId}/logo/${newId()}.webp`;
    await this.storage.putObject({
      key,
      body: processed,
      contentType: 'image/webp',
    });

    await this.prisma.houseboat.update({
      where: { id: houseboatId },
      data: { logoStorageKey: key },
    });
    if (boat.logoStorageKey) {
      await this.storage.delete(boat.logoStorageKey).catch(() => undefined);
    }
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'houseboat_logo_update',
      entityType: 'houseboat',
      entityId: houseboatId,
    });
    return { logoUrl: this.storage.publicUrl(key) };
  }

  /** Remove the boat logo (its R2 object and the column). */
  async removeLogo(houseboatId: string, actorId: string) {
    const boat = await this.prisma.houseboat.findUnique({
      where: { id: houseboatId },
      select: { logoStorageKey: true },
    });
    if (!boat) throw new NotFoundException('Houseboat not found');
    if (boat.logoStorageKey) {
      await this.storage.delete(boat.logoStorageKey).catch(() => undefined);
      await this.prisma.houseboat.update({
        where: { id: houseboatId },
        data: { logoStorageKey: null },
      });
    }
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'houseboat_logo_update',
      entityType: 'houseboat',
      entityId: houseboatId,
    });
    return { ok: true };
  }
}
