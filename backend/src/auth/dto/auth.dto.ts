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

/**
 * Shared password policy — the single source of truth for register AND reset.
 * At least 6 chars, and must contain a letter and a number. Special characters
 * are allowed but not required (the rule below permits them).
 */
export const PASSWORD_MIN = 6;
export const PASSWORD_RULE = /(?=.*[A-Za-z])(?=.*\d)/;
export const PASSWORD_RULE_MESSAGE =
  'password must contain at least one letter and one number';

export class RegisterDto {
  @IsString()
  @Matches(BD_PHONE, { message: 'phone must be a valid Bangladeshi mobile number' })
  phone!: string;

  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `password must be at least ${PASSWORD_MIN} characters`,
  })
  @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_MESSAGE })
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

// ── Password reset (forgot-password via SMS OTP) ────────────────────────────

/** Step 1: request an OTP to a phone number. */
export class RequestOtpDto {
  @IsString()
  @Matches(BD_PHONE, { message: 'phone must be a valid Bangladeshi mobile number' })
  phone!: string;
}

/** Step 2: verify the 6-digit code and get a single-use reset ticket. */
export class VerifyOtpDto {
  @IsString()
  @Matches(BD_PHONE, { message: 'phone must be a valid Bangladeshi mobile number' })
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
  code!: string;
}

/** Step 3: set a new password using the reset ticket. */
export class ResetPasswordDto {
  @IsString()
  resetTicket!: string;

  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `password must be at least ${PASSWORD_MIN} characters`,
  })
  @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_MESSAGE })
  @MaxLength(PASSWORD_MAX)
  password!: string;
}
