import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  LEN_CODE,
  LEN_LONG_TEXT,
  LEN_NAME,
  LEN_TEXT,
} from '../../common/field-limits';

export class CreateCostDto {
  @IsString() @MaxLength(LEN_CODE) date!: string; // ISO
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) description?: string;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) tripId?: string;
  @IsOptional() @IsNumber() @Min(0) dueToVendor?: number;
}

export class CreateInventoryItemDto {
  @IsString() @MaxLength(LEN_NAME) name!: string;
  @IsIn(['consumable', 'durable']) kind!: 'consumable' | 'durable';
  @IsOptional() @IsString() @MaxLength(LEN_CODE) unit?: string;
  @IsOptional() @IsNumber() @Min(0) reorderThreshold?: number;
  @IsOptional() @IsNumber() @Min(0) currentQty?: number;
}

export class StockMovementDto {
  @IsIn(['in', 'out', 'count']) direction!: 'in' | 'out' | 'count';
  @IsNumber() qty!: number;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) tripId?: string;
}

export class CreateReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) text?: string;
}
