import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Bangladeshi mobile: +8801XXXXXXXXX or 01XXXXXXXXX
const BD_PHONE = /^(?:\+?8801|01)[3-9]\d{8}$/;

/**
 * bcrypt only reads the first 72 bytes of input, so anything beyond that is
 * silently ignored — capping here costs nothing and stops an unauthenticated
 * caller from forcing cost-12 hashing over a megabyte-sized "password".
 */
const PASSWORD_MAX = 72;

export class RegisterDto {
  @IsString()
  @Matches(BD_PHONE, { message: 'phone must be a valid Bangladeshi mobile number' })
  phone!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(PASSWORD_MAX)
  password!: string;

  /**
   * Required: every booking, voucher and boarding list is read by a human at
   * the ghat, so an account with no name is not usable operationally.
   * Trimmed before length-checking so "   " cannot pass as a name.
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2, { message: 'name must be at least 2 characters' })
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254) // RFC 5321 max address length
  email?: string;
}

export class LoginDto {
  @IsString()
  @Matches(BD_PHONE, { message: 'phone must be a valid Bangladeshi mobile number' })
  phone!: string;

  @IsString()
  @MaxLength(PASSWORD_MAX)
  password!: string;

  // "Keep me signed in": when true, the refresh/session cookies get a 30-day
  // maxAge; when false/absent they are session-scoped and drop on browser close.
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
