import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PermissionMap } from '../permission.types';

export class CreateRoleDto {
  @IsString() name!: string;
  @IsObject() permissions!: PermissionMap;
  @IsOptional() @IsBoolean() isTemplate?: boolean;
}

export class UpdateRoleDto {
  @IsString() name!: string;
  @IsObject() permissions!: PermissionMap;
}

export class AddMemberDto {
  @IsString() phone!: string;
  @IsString() roleId!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) shareholderPct?: number;
}

export class ChangeRoleDto {
  @IsString() roleId!: string;
}
