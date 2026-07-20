import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateStaffDto {
  @IsString() phone!: string; // links to an existing account
  @IsOptional() @IsString() roleId?: string;
  @IsOptional() @IsString() nid?: string;
  @IsOptional() @IsString() emergencyContact?: string;
  @IsOptional() @IsNumber() @Min(0) perTripRate?: number;
  @IsOptional() @IsNumber() @Min(0) monthlySalary?: number;
}

export class LeaveDto {
  @IsIn(['on_leave', 'available', 'other_duty']) state!: string;
  @IsOptional() @IsString() fromDate?: string;
  @IsOptional() @IsString() toDate?: string;
  @IsOptional() @IsString() note?: string;
}

export class PayrollDto {
  @IsString() period!: string; // e.g. "2026-07"
  @IsOptional() @IsNumber() @Min(0) bonus?: number;
  @IsOptional() @IsNumber() @Min(0) deduction?: number;
}

export class CrewPresenceDto {
  @IsString() staffId!: string;
  @IsOptional() present?: boolean;
}
