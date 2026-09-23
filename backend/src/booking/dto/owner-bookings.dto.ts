import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { LEN_CODE, LEN_NAME, LEN_TEXT } from '../../common/field-limits';
import { PageQueryDto } from '../../common/dto/pagination.dto';

/**
 * Booking status values a filter may request. 'rescheduled' was removed with the
 * reschedule feature — nothing writes it any more, and status counts are computed
 * dynamically (groupBy), so any legacy 'rescheduled' row still displays; it just
 * can no longer be selected as a filter.
 */
export const BOOKING_STATUSES = [
  'confirmed',
  'cancelled',
  'not_arrived',
  'completed',
] as const;

/** Departure attendance, set by the owner on the manifest (§4). */
export const CHECKIN_STATUSES = ['pending', 'checked_in', 'absent'] as const;

/** Owner collection channels for a counter sale / due payment (§6). */
export const OWNER_PAYMENT_METHODS = ['cash', 'bkash', 'bank', 'online'] as const;

export class CheckinDto {
  @IsIn(CHECKIN_STATUSES) status!: (typeof CHECKIN_STATUSES)[number];
}

export class OwnerBookingsQueryDto extends PageQueryDto {
  /**
   * One booking status, or a comma-separated list (e.g. `confirmed,completed`).
   * The departure manifest passes both so a trip's guests stay visible after the
   * completion cron relabels their bookings `confirmed → completed`. Normalized
   * to a string[]; the service maps a single value to `status:` and many to
   * `status: { in: [...] }`.
   */
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((s) => s.trim()).filter(Boolean)
      : value,
  )
  @IsArray()
  @IsIn(BOOKING_STATUSES, { each: true })
  @ArrayMaxSize(BOOKING_STATUSES.length)
  status?: string[];
  /** Guest name or phone. */
  @IsOptional() @IsString() @MaxLength(LEN_NAME) q?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) departureId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class PosCabinDto {
  @IsString() @MaxLength(LEN_CODE) cabinId!: string;
  @IsInt() @Min(1) adults!: number;
  @IsOptional() @IsInt() @Min(0) children?: number;
}

/** Upper bound on any single money field — guards against fat-finger / overflow. */
const MONEY_MAX = 10_000_000;

/** Children's ages, for per-band child pricing. Shared by held-cabin DTOs. */
const CHILD_AGES = {
  each: true,
} as const;

/**
 * A cabin already held by the operator (the select step took the hold and
 * started the countdown). Confirm-sale converts these instead of re-holding.
 */
export class PosHeldCabinDto {
  @IsString() @MaxLength(LEN_CODE) cabinId!: string;
  @IsString() @MaxLength(LEN_CODE) holdId!: string;
  @IsInt() @Min(1) adults!: number;
  @IsOptional() @IsInt() @Min(0) children?: number;
  /** Ages of the children so each is charged per the boat's child_policy. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt(CHILD_AGES)
  @Min(0, CHILD_AGES)
  @Max(120, CHILD_AGES)
  childAges?: number[];
  /**
   * Owner-typed room price for a cabin whose occupancy tier has no configured
   * rate. Replaces the computed price for this cabin only. Counter-sale only.
   */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MONEY_MAX) priceOverride?: number;
}

export class PosCheckoutDto {
  @IsString() @MaxLength(LEN_CODE) departureId!: string;
  @IsString() @MaxLength(LEN_NAME) customerName!: string;
  /** E.164. Used to find-or-create the walk-in guest's account. */
  @IsString() @MaxLength(LEN_CODE) customerPhone!: string;

  /**
   * Legacy single-request path: hold + checkout in one call. Optional now that
   * the counter grid holds cabins on select and sends `holds` instead. Exactly
   * one of `cabins` / `holds` is used; `holds` wins when present.
   */
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PosCabinDto)
  @IsArray()
  @ArrayMaxSize(50)
  cabins?: PosCabinDto[];

  /** Cabins already held from the select step, to be converted on confirm. */
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PosHeldCabinDto)
  @IsArray()
  @ArrayMaxSize(50)
  holds?: PosHeldCabinDto[];

  @IsOptional() @IsString() @MaxLength(LEN_CODE) couponCode?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) referenceName?: string;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) specialInstructions?: string;

  /**
   * Operator confirmation to attach this sale to a pre-existing account when the
   * typed phone already belongs to a customer under a different name. Without it
   * the checkout refuses (409), so a mistyped number can't silently land the
   * booking on a stranger.
   */
  @IsOptional() @IsBoolean() attachToExisting?: boolean;
  /** Owner's personal collection channel for cash taken at the counter (§6). */
  @IsOptional() @IsIn(OWNER_PAYMENT_METHODS) paymentMethod?: (typeof OWNER_PAYMENT_METHODS)[number];

  /**
   * Ad-hoc flat discount (taka) the owner grants at the counter, deducted from
   * the total on top of any coupon. The boat absorbs it.
   */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MONEY_MAX) discount?: number;
  /**
   * How much the customer actually handed over. Defaults to the full total when
   * omitted. 0 = nothing paid yet (booking still confirms; invoice stays due).
   */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MONEY_MAX) amountPaid?: number;
}

/** One cabin in a price quote (no hold needed — read-only). */
export class PosQuoteCabinDto {
  @IsString() @MaxLength(LEN_CODE) cabinId!: string;
  @IsInt() @Min(1) adults!: number;
  @IsOptional() @IsInt() @Min(0) children?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt(CHILD_AGES)
  @Min(0, CHILD_AGES)
  @Max(120, CHILD_AGES)
  childAges?: number[];
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MONEY_MAX) priceOverride?: number;
}

/** Read-only price preview for a counter-sale selection. Creates nothing. */
export class PosQuoteDto {
  @IsString() @MaxLength(LEN_CODE) departureId!: string;

  @ValidateNested({ each: true })
  @Type(() => PosQuoteCabinDto)
  @IsArray()
  @ArrayMaxSize(50)
  cabins!: PosQuoteCabinDto[];

  @IsOptional() @IsString() @MaxLength(LEN_CODE) couponCode?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MONEY_MAX) discount?: number;
}
