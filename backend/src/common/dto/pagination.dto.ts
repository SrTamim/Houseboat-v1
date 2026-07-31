import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
// Bounds live in paginate.ts so that module stays decorator-free.
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../paginate';

/**
 * Cursor pagination for platform list endpoints.
 *
 * Cursor rather than offset because every PK here is a UUIDv7 (see
 * common/uuid.ts) — time-ordered, so `orderBy id desc` + `cursor` is a stable,
 * index-backed "newest first" with no COUNT(*) and no page drift when rows are
 * inserted mid-scroll.
 *
 * Applied only to new /api/platform/* routes; existing endpoints keep their
 * current shape so the public site and the offline-sync client are unaffected.
 */
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number = DEFAULT_PAGE_SIZE;

  /** id of the last row from the previous page. */
  @IsOptional()
  @IsUUID()
  cursor?: string;
}

export type { Page } from '../paginate';
