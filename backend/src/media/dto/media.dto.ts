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

/** Add a YouTube video to a boat/cabin gallery. */
export class CreateVideoDto {
  @IsOptional() @IsUUID() cabinId?: string;
  @IsUrl() youtubeUrl!: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
