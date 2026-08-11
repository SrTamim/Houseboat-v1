import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LEN_CODE } from '../../common/field-limits';

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
