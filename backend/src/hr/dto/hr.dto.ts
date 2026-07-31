import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { LEN_CODE, LEN_NAME, LEN_TEXT } from '../../common/field-limits';

export class CreateStaffDto {
  @IsString() @MaxLength(LEN_CODE) phone!: string; // links to an existing account
  @IsOptional() @IsString() @MaxLength(LEN_CODE) roleId?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) nid?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) emergencyContact?: string;
  @IsOptional() @IsNumber() @Min(0) perTripRate?: number;
  @IsOptional() @IsNumber() @Min(0) monthlySalary?: number;
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

export class CrewPresenceDto {
  @IsString() @MaxLength(LEN_CODE) staffId!: string;
  // Needs a validator: whitelist only strips properties that have one.
  @IsOptional() @IsBoolean() present?: boolean;
}
