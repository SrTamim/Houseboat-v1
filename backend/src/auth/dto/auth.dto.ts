import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';

// Bangladeshi mobile: +8801XXXXXXXXX or 01XXXXXXXXX
const BD_PHONE = /^(?:\+?8801|01)[3-9]\d{8}$/;

export class RegisterDto {
  @IsString()
  @Matches(BD_PHONE, { message: 'phone must be a valid Bangladeshi mobile number' })
  phone!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class LoginDto {
  @IsString()
  @Matches(BD_PHONE, { message: 'phone must be a valid Bangladeshi mobile number' })
  phone!: string;

  @IsString()
  password!: string;
}
