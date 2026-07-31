import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { LEN_NAME } from '../../common/field-limits';

// Deep validation of `permissions` happens in validatePlatformPermissionMap
// (platform/rbac/platform-permission.types.ts) — same precedent as the
// @IsObject bankDetails field in money.dto.ts.

export class CreatePlatformRoleDto {
  @IsString() @MaxLength(LEN_NAME) name!: string;
  @IsObject() permissions!: Record<string, unknown>;
}

export class UpdatePlatformRoleDto {
  @IsOptional() @IsString() @MaxLength(LEN_NAME) name?: string;
  @IsOptional() @IsObject() permissions?: Record<string, unknown>;
}

export class AssignPlatformRoleDto {
  /** null = superadmin (no role restriction). */
  @IsOptional() @IsUUID() platformRoleId?: string | null;
}

export class SetPlatformStaffDto {
  @IsBoolean() isPlatform!: boolean;
}
