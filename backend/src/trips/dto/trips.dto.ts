import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
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

/** Edit an existing package — every field optional (partial update). */
export class UpdatePackageDto {
  @IsOptional() @IsString() @MaxLength(LEN_CODE) routeId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(365) durationDays?: number;
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

/** Edit one generated departure — date (must be an operating date), time, pricing. */
export class UpdateDepartureDto {
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) departureTime?: string; // HH:mm
  @IsOptional() @IsString() @MaxLength(LEN_CODE) arrivalTime?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) pricingProfileId?: string;
}

/** One weekly trip slot (Trip 1..7) in the recurring schedule (§1). */
export class ScheduleSlotDto {
  @IsInt() @Min(1) @Max(7) slotNo!: number;
  /** Days of week, 0=Sun … 6=Sat. At least one required. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays!: number[];
  // A submitted slot must fully define its trip: time + pricing profile.
  @IsString() @MaxLength(LEN_CODE) departureTime!: string; // HH:mm
  @IsString() @MaxLength(LEN_CODE) pricingProfileId!: string;
}

/** Save the boat's weekly schedule: a package + up to 7 trip slots (§1). */
export class SaveScheduleDto {
  @IsString() @MaxLength(LEN_CODE) packageId!: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @ValidateNested({ each: true })
  @Type(() => ScheduleSlotDto)
  @IsArray()
  @ArrayMaxSize(7)
  slots!: ScheduleSlotDto[];
}

/** Owner cancels a generated departure — reason is shown to affected customers. */
export class CancelDepartureDto {
  @IsString() @MaxLength(LEN_LONG_TEXT) reason!: string;
}
