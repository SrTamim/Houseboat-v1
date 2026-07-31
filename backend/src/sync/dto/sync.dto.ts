import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsObject,
  IsUUID,
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
  @IsUUID() intentId!: string;
  @IsUUID() houseboatId!: string;
  @IsIn(OFFLINE_ALLOWED as unknown as string[]) action!: OfflineAction;
  @IsObject() payload!: Record<string, unknown>;
  /** Device clock when the action was taken (may be manipulated). */
  @IsISO8601() deviceTime!: string;
}

/**
 * One offline device's queued actions. The batch is bounded so a single
 * request can't force unbounded work; a device with more than this replays
 * across several calls, which the intentId idempotency already supports.
 */
export class SyncBatchDto {
  @ValidateNested({ each: true })
  @Type(() => SyncIntentDto)
  @IsArray()
  @ArrayMaxSize(200)
  intents!: SyncIntentDto[];
}
