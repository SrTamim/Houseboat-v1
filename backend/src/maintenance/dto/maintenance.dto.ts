import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LEN_NAME, LEN_TEXT } from '../../common/field-limits';

/** How soon a request needs attention. */
export const REQUEST_URGENCIES = ['low', 'medium', 'high'] as const;

/** Lifecycle of a request. */
export const REQUEST_STATUSES = [
  'pending',
  'in_progress',
  'complete',
  'canceled',
] as const;

export class CreateMaintenanceRequestDto {
  @IsString() @MaxLength(LEN_NAME) topic!: string;
  @IsIn(REQUEST_URGENCIES) urgency!: (typeof REQUEST_URGENCIES)[number];
  /** Optional opening note, stored as the first comment. */
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) comment?: string;
}

export class UpdateMaintenanceRequestDto {
  @IsOptional() @IsString() @MaxLength(LEN_NAME) topic?: string;
  @IsOptional() @IsIn(REQUEST_URGENCIES) urgency?: (typeof REQUEST_URGENCIES)[number];
  @IsOptional() @IsIn(REQUEST_STATUSES) status?: (typeof REQUEST_STATUSES)[number];
  /** Comment attached to this change; when `status` is set it tags the transition. */
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) comment?: string;
}

export class AddRequestCommentDto {
  @IsString() @MaxLength(LEN_TEXT) body!: string;
}
