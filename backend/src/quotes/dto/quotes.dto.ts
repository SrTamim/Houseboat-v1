import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { LEN_LONG_TEXT } from '../../common/field-limits';

export class CreateQuoteDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsInt() @Min(1) groupSize?: number;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) specialNeeds?: string;
}

export class PriceQuoteDto {
  // 2dp to match the money-DTO convention (numeric(12,2) is the DB ceiling);
  // owner-set but should not carry sub-paisa noise (audit #14/F22).
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() quotedPrice!: number;
}

export class ReplyQuoteDto {
  @IsString() @MaxLength(LEN_LONG_TEXT) message!: string;
}
