import {
  IsArray,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Actions permitted offline (plan §6). Booking + trip-cancel are BLOCKED. */
export const OFFLINE_ALLOWED = [
  'cost_add',
  'stock_movement',
  'mark_cash_paid',
  'mark_not_arrived',
  'date_change',
] as const;
export type OfflineAction = (typeof OFFLINE_ALLOWED)[number];

export class SyncIntentDto {
  /** Client-generated id so replays of the same intent are idempotent. */
  @IsString() intentId!: string;
  @IsString() houseboatId!: string;
  @IsIn(OFFLINE_ALLOWED as unknown as string[]) action!: OfflineAction;
  @IsObject() payload!: Record<string, unknown>;
  /** Device clock when the action was taken (may be manipulated). */
  @IsISO8601() deviceTime!: string;
}

export class SyncBatchDto {
  @ValidateNested({ each: true })
  @Type(() => SyncIntentDto)
  @IsArray()
  intents!: SyncIntentDto[];
}
