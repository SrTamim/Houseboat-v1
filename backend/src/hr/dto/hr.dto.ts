import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { LEN_CODE, LEN_NAME, LEN_TEXT } from '../../common/field-limits';

export class CreateStaffDto {
  @IsString() @MaxLength(LEN_CODE) phone!: string; // links to an existing account
  @IsOptional() @IsString() @MaxLength(LEN_CODE) roleId?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) designation?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) nid?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) emergencyContact?: string;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) address?: string;
  @IsOptional() @IsNumber() @Min(0) perTripRate?: number;
  @IsOptional() @IsNumber() @Min(0) monthlySalary?: number;
}

export class UpdateStaffDto {
  @IsOptional() @IsString() @MaxLength(LEN_NAME) designation?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) nid?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) emergencyContact?: string;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) address?: string;
  @IsOptional() @IsIn(['available', 'on_leave']) status?: string;
  // Pay-type is per_trip XOR salary. Frontend sends the active field as a number
  // and the inactive one as null so switching clears the other; @ValidateIf lets
  // null through the @IsNumber check.
  @ValidateIf((o) => o.perTripRate !== null)
  @IsOptional()
  @IsNumber()
  @Min(0)
  perTripRate?: number | null;
  @ValidateIf((o) => o.monthlySalary !== null)
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlySalary?: number | null;
}

export class LeaveDto {
  @IsIn(['on_leave', 'available', 'other_duty']) state!: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) fromDate?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) toDate?: string;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) note?: string;
}

export class PayrollDto {
  @IsString() @MaxLength(LEN_CODE) period!: string; // e.g. "2026-07"
  @IsOptional() @IsNumber() @Min(0) bonus?: number;
  @IsOptional() @IsNumber() @Min(0) deduction?: number;
}

export class AdjustPayrollDto {
  @IsOptional() @IsNumber() @Min(0) bonus?: number;
  @IsOptional() @IsNumber() @Min(0) deduction?: number;
  // Flip paid state — e.g. revert an accidental mark-paid.
  @IsOptional() @IsBoolean() paid?: boolean;
}

export class AttendanceQueryDto {
  // Month to report on, "YYYY-MM". Defaults to the current month when omitted.
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'period must be YYYY-MM' })
  period?: string;
}

export class CrewPresenceDto {
  @IsString() @MaxLength(LEN_CODE) staffId!: string;
  // Needs a validator: whitelist only strips properties that have one.
  @IsOptional() @IsBoolean() present?: boolean;
}
