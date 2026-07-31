import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PermissionMap } from '../permission.types';
import { LEN_CODE, LEN_NAME } from '../../common/field-limits';

export class CreateRoleDto {
  @IsString() @MaxLength(LEN_NAME) name!: string;
  @IsObject() permissions!: PermissionMap;
  @IsOptional() @IsBoolean() isTemplate?: boolean;
}

export class UpdateRoleDto {
  @IsString() @MaxLength(LEN_NAME) name!: string;
  @IsObject() permissions!: PermissionMap;
}

export class AddMemberDto {
  @IsString() @MaxLength(LEN_CODE) phone!: string;
  @IsString() @MaxLength(LEN_CODE) roleId!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) shareholderPct?: number;
}

export class ChangeRoleDto {
  @IsString() @MaxLength(LEN_CODE) roleId!: string;
}

export class MySettingsDto {
  /**
   * Per-event notification toggles: {"booking":true,"payment_due":false,…}.
   * Left open rather than a fixed DTO so adding an event type needs no
   * migration; the console owns which keys it renders.
   */
  @IsOptional() @IsObject() notificationPrefs?: Record<string, boolean>;
}
