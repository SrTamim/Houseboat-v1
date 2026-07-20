import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateCostDto {
  @IsString() date!: string; // ISO
  @IsOptional() @IsString() description?: string;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() tripId?: string;
  @IsOptional() @IsNumber() @Min(0) dueToVendor?: number;
}

export class CreateInventoryItemDto {
  @IsString() name!: string;
  @IsIn(['consumable', 'durable']) kind!: 'consumable' | 'durable';
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() @Min(0) reorderThreshold?: number;
  @IsOptional() @IsNumber() @Min(0) currentQty?: number;
}

export class StockMovementDto {
  @IsIn(['in', 'out', 'count']) direction!: 'in' | 'out' | 'count';
  @IsNumber() qty!: number;
  @IsOptional() @IsString() tripId?: string;
}

export class CreateReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() text?: string;
}
