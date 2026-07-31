import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LEN_CODE, LEN_NAME } from '../../common/field-limits';

export class PriceRuleDto {
  @IsString() @MaxLength(LEN_CODE) cabinCategoryId!: string;
  @IsInt() @Min(1) occupancy!: number;
  @IsNumber() @Min(0) pricePerPerson!: number;
}

export class CreatePricingProfileDto {
  @IsString() @MaxLength(LEN_NAME) name!: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  /** ISO date strings the profile applies to. Empty for the default profile. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(400) // ~13 months of daily dates
  @IsString({ each: true })
  @MaxLength(LEN_CODE, { each: true })
  dates?: string[];
  /** Full independent price table for this profile. */
  @ValidateNested({ each: true })
  @Type(() => PriceRuleDto)
  @IsArray()
  @ArrayMaxSize(500)
  rules!: PriceRuleDto[];
}

export class GroupBandDto {
  @IsInt() @Min(1) minPeople!: number;
  @IsInt() @Min(1) maxPeople!: number;
  @IsNumber() @Min(0) totalPrice!: number;
}
