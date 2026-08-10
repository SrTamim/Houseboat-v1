import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import { dirname, join, normalize, sep } from 'path';

/**
 * Object storage with two interchangeable drivers behind one surface:
 *
 *  - 'local' (dev default): writes the processed bytes to disk under localDir
 *    and serves them via the /uploads static mount (see main.ts). No creds.
 *  - 'r2': Cloudflare R2 (S3-compatible). Uploaded THROUGH the API so images
 *    can be resized/compressed (sharp) before being PUT.
 *
 * Keys look like `houseboats/<id>/boat/<uuid>.webp` — a safe relative path
 * under localDir, and the object key under R2.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {}

  private get driver(): string {
    return this.config.get<string>('storage.driver') ?? 'local';
  }

  private get localDir(): string {
    return this.config.get<string>('storage.localDir') ?? 'uploads';
  }

  // Build the R2 client once DI is wired (reading config in the constructor is
  // DI-order-fragile). Local driver needs no client.
  onModuleInit(): void {
    if (this.driver !== 'r2') return;
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

  /** Resolve a key to an absolute path inside localDir, rejecting traversal. */
  private localPath(key: string): string {
    const base = join(process.cwd(), this.localDir);
    const full = normalize(join(base, key));
    if (full !== base && !full.startsWith(base + sep)) {
      throw new BadRequestException('Invalid storage key');
    }
    return full;
  }

  /** Public URL for a stored object. */
  publicUrl(key: string): string {
    if (this.driver === 'local') {
      // Root-relative so the browser loads it from its own origin (the frontend
      // proxies /uploads/* to this backend's static mount). Keeps uploaded
      // images same-origin, satisfying the CSP `img-src 'self'` — matching the
      // single-origin model the rest of the app uses for /api.
      return `/uploads/${key}`;
    }
    const base = this.config.get<string>('storage.publicBaseUrl') ?? '';
    return `${base.replace(/\/$/, '')}/${key}`;
  }

  /** Upload bytes (server-side, after sharp processing). */
  async putObject(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<{ key: string }> {
    if (this.driver === 'local') {
      const path = this.localPath(params.key);
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(path, params.body);
      return { key: params.key };
    }
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
    if (this.driver === 'local') {
      await fs.rm(this.localPath(key), { force: true });
      return;
    }
    await this.client!.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
