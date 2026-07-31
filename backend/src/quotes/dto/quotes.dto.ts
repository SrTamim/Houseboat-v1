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
  @IsNumber() @IsPositive() quotedPrice!: number;
}
