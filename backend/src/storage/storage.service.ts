import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 (S3-compatible) object storage. Images are uploaded THROUGH the
 * API so they can be resized/compressed (sharp) before being PUT to R2. The
 * public URL is publicBaseUrl + key (R2 public bucket / CDN).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {}

  // Build the R2 client once DI is wired (reading config in the constructor is
  // DI-order-fragile).
  onModuleInit(): void {
    const endpoint = this.config.get<string>('storage.endpoint');
    const accessKeyId = this.config.get<string>('storage.accessKeyId');
    const secretAccessKey = this.config.get<string>('storage.secretAccessKey');
    // R2 ignores region but the SDK requires one; 'auto' is the R2 convention.
    this.client =
      endpoint && accessKeyId && secretAccessKey
        ? new S3Client({
            endpoint,
            region: this.config.get<string>('storage.region') ?? 'auto',
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
  }

  private get bucket(): string {
    const b = this.config.get<string>('storage.bucket');
    if (!b || !this.client) {
      throw new BadRequestException('Object storage is not configured');
    }
    return b;
  }

  /** Public URL for a stored object. */
  publicUrl(key: string): string {
    const base = this.config.get<string>('storage.publicBaseUrl') ?? '';
    return `${base.replace(/\/$/, '')}/${key}`;
  }

  /** Upload bytes to R2 (server-side, after sharp processing). */
  async putObject(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<{ key: string }> {
    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return { key: params.key };
  }

  async delete(key: string): Promise<void> {
    await this.client!.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
