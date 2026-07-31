import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LEN_CODE, LEN_NAME, LEN_TEXT } from '../../common/field-limits';
import { PageQueryDto } from '../../common/dto/pagination.dto';

/** Mirrors booking.status in the schema. */
export const BOOKING_STATUSES = [
  'confirmed',
  'rescheduled',
  'cancelled',
  'not_arrived',
  'completed',
] as const;

export class OwnerBookingsQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(BOOKING_STATUSES) status?: string;
  /** Guest name or phone. */
  @IsOptional() @IsString() @MaxLength(LEN_NAME) q?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) departureId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class PosCabinDto {
  @IsString() @MaxLength(LEN_CODE) cabinId!: string;
  @IsInt() @Min(1) adults!: number;
  @IsOptional() @IsInt() @Min(0) children?: number;
}

export class PosCheckoutDto {
  @IsString() @MaxLength(LEN_CODE) departureId!: string;
  @IsString() @MaxLength(LEN_NAME) customerName!: string;
  /** E.164. Used to find-or-create the walk-in guest's account. */
  @IsString() @MaxLength(LEN_CODE) customerPhone!: string;

  @ValidateNested({ each: true })
  @Type(() => PosCabinDto)
  @IsArray()
  @ArrayMaxSize(50)
  cabins!: PosCabinDto[];

  @IsOptional() @IsString() @MaxLength(LEN_CODE) couponCode?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) referenceName?: string;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) specialInstructions?: string;
}
