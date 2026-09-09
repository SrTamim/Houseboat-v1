import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { LEN_CODE } from '../../common/field-limits';

/** Sort keys accepted by the results endpoint (frontend Sort + backend legacy). */
export const SEARCH_SORTS = [
  'recommended',
  'newest',
  'price_asc',
  'price_desc',
  'rating',
  'reviews',
] as const;

/**
 * Public boat search filters. All optional — an empty query lists every live
 * boat. Price/guests are numbers (transformed from the query string); `ac` is a
 * tri-state ('ac' | 'nonac' | 'both'); `sort` picks the ordering.
 */
export class SearchHouseboatsDto {
  /** Route id or region text match. */
  @IsOptional() @IsString() @MaxLength(LEN_CODE) route?: string;

  /** Only boats with a scheduled, available departure on/after this date. */
  @IsOptional() @IsString() @MaxLength(32) date?: string;

  /** 'ac' → has an AC category; 'nonac' → has a non-AC category; 'both'/absent → no filter. */
  @IsOptional() @IsIn(['ac', 'nonac', 'both']) ac?: 'ac' | 'nonac' | 'both';

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPrice?: number;

  /** At least one cabin category that seats this many. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) guests?: number;

  @IsOptional()
  @IsIn(['price_asc', 'price_desc', 'rating', 'newest'])
  sort?: 'price_asc' | 'price_desc' | 'rating' | 'newest';
}

/**
 * Results-page search: the base filters plus rating, amenities, the full sort
 * vocabulary, and offset pagination. Backs GET /houseboats/search/results, which
 * returns { items, total, page, pageSize, facets } — distinct from the bare
 * /houseboats/search flat array the home page still uses.
 *
 * Standalone (not extending SearchHouseboatsDto) so `sort` can carry the wider
 * vocabulary without clashing with the base's narrower enum.
 */
export class SearchResultsDto {
  @IsOptional() @IsString() @MaxLength(LEN_CODE) route?: string;
  @IsOptional() @IsString() @MaxLength(32) date?: string;
  @IsOptional() @IsIn(['ac', 'nonac', 'both']) ac?: 'ac' | 'nonac' | 'both';
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) guests?: number;

  /** Minimum average rating (e.g. 3, 4, 5). */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5) rating?: number;

  /**
   * Amenity keywords; every one must appear in the boat's rolled-up facilities.
   * A single `?amenities=x` arrives as a string — normalize to an array.
   */
  @IsOptional()
  @Transform(({ value }) =>
    value == null ? value : Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  amenities?: string[];

  /** Size-bucket keys (small/medium/large); a single value arrives as a string. */
  @IsOptional()
  @Transform(({ value }) =>
    value == null ? value : Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @IsIn(['small', 'medium', 'large'], { each: true })
  sizes?: string[];

  @IsOptional() @IsIn(SEARCH_SORTS as unknown as string[]) sort?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) pageSize?: number;
}
