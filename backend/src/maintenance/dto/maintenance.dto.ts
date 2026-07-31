import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LEN_NAME, LEN_TEXT } from '../../common/field-limits';

/** engine_hours = due at a meter reading; calendar = due on a date; per_trip = every departure. */
export const INTERVAL_KINDS = ['engine_hours', 'calendar', 'per_trip'] as const;

/** A meter reading above this is a typo, not a boat. Keeps due-date maths sane. */
const MAX_ENGINE_HOURS = 1_000_000;

export class CreateMaintenanceTaskDto {
  @IsString() @MaxLength(LEN_NAME) title!: string;
  @IsIn(INTERVAL_KINDS) intervalKind!: (typeof INTERVAL_KINDS)[number];
  /** hours for engine_hours, days for calendar; ignored for per_trip. */
  @IsOptional() @IsInt() @Min(1) @Max(MAX_ENGINE_HOURS) intervalValue?: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_ENGINE_HOURS) dueAtHours?: number;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) notes?: string;
}

export class UpdateMaintenanceTaskDto {
  @IsOptional() @IsString() @MaxLength(LEN_NAME) title?: string;
  @IsOptional() @IsInt() @Min(1) @Max(MAX_ENGINE_HOURS) intervalValue?: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_ENGINE_HOURS) dueAtHours?: number;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsIn(['active', 'paused']) status?: string;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) notes?: string;
}

/** Marking a task done; also the ad-hoc "log a service" body. */
export class CompleteTaskDto {
  @IsOptional() @IsDateString() serviceDate?: string;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_ENGINE_HOURS) engineHours?: number;
  @IsOptional() @IsNumber() @Min(0) cost?: number;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) note?: string;
}

export class CreateServiceLogDto extends CompleteTaskDto {
  @IsOptional() @IsString() @MaxLength(LEN_NAME) taskId?: string;
}

export class CreateDamageDto {
  @IsString() @MaxLength(LEN_NAME) title!: string;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) detail?: string;
}

export class UpdateDamageDto {
  @IsOptional() @IsIn(['open', 'fixed']) status?: string;
  @IsOptional() @IsNumber() @Min(0) repairCost?: number;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) detail?: string;
}

export class SetEngineHoursDto {
  @IsInt() @Min(0) @Max(MAX_ENGINE_HOURS) hours!: number;
}
