import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsDateString,
} from 'class-validator';
import {
  LEN_CODE,
  LEN_LONG_TEXT,
  LEN_NAME,
} from '../../common/field-limits';

export class CreatePackageDto {
  @IsString() @MaxLength(LEN_CODE) routeId!: string;
  // Upper bound too: durationDays drives departure generation.
  @IsInt() @Min(1) @Max(365) durationDays!: number;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) durationLabel?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) departureGhat?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) returnGhat?: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) meals?: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) included?: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) excluded?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) cancellationPolicyId?: string;
}

export class CreateDepartureDto {
  @IsString() @MaxLength(LEN_CODE) packageId!: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) departureTime?: string; // HH:mm
  @IsOptional() @IsString() @MaxLength(LEN_CODE) arrivalTime?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) pricingProfileId?: string;
}
