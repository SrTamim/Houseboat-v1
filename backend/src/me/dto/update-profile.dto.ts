import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { LEN_NAME } from '../../common/field-limits';

// Bangladeshi mobile: +8801XXXXXXXXX or 01XXXXXXXXX (same rule as auth).
const BD_PHONE = /^(?:\+?8801|01)[3-9]\d{8}$/;

/**
 * Customer self-service profile update. Every field optional — only the ones
 * present are changed. Phone stays BD-format + unique; email is optional. No
 * password change here (that has its own guarded flow).
 */
export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(LEN_NAME) name?: string;

  @IsOptional()
  @IsString()
  @Matches(BD_PHONE, { message: 'phone must be a valid Bangladeshi mobile number' })
  phone?: string;

  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
}
