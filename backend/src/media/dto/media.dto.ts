import {
  IsInt,
  IsOptional,
  IsUrl,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Image upload metadata (multipart form fields alongside the file). Numbers
 * arrive as strings in multipart, so coerce with @Type.
 */
export class UploadImageDto {
  @IsOptional() @IsUUID() cabinId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

/**
 * Gallery filter. This route is @Public(), and a primitive @Query param skips
 * the global ValidationPipe entirely — so validate the UUID rather than
 * passing an arbitrary string to Prisma.
 */
export class ListMediaQueryDto {
  @IsOptional() @IsUUID() cabinId?: string;
}

/**
 * Add a video link to a boat/cabin gallery. Must be an https URL for an
 * allowlisted provider — the service rejects anything that doesn't resolve.
 */
export class CreateVideoDto {
  @IsOptional() @IsUUID() cabinId?: string;
  @IsUrl({ protocols: ['https'], require_protocol: true }) videoUrl!: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
