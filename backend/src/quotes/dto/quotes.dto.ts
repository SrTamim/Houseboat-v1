import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateQuoteDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsInt() @Min(1) groupSize?: number;
  @IsOptional() @IsString() specialNeeds?: string;
}

export class PriceQuoteDto {
  @IsNumber() @IsPositive() quotedPrice!: number;
}
