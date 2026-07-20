import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PriceRuleDto {
  @IsString() cabinCategoryId!: string;
  @IsInt() @Min(1) occupancy!: number;
  @IsNumber() @Min(0) pricePerPerson!: number;
}

export class CreatePricingProfileDto {
  @IsString() name!: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  /** ISO date strings the profile applies to. Empty for the default profile. */
  @IsOptional() @IsArray() dates?: string[];
  /** Full independent price table for this profile. */
  @ValidateNested({ each: true })
  @Type(() => PriceRuleDto)
  @IsArray()
  rules!: PriceRuleDto[];
}

export class GroupBandDto {
  @IsInt() @Min(1) minPeople!: number;
  @IsInt() @Min(1) maxPeople!: number;
  @IsNumber() @Min(0) totalPrice!: number;
}
