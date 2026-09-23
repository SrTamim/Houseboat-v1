import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LEN_CODE, LEN_NAME, LEN_TEXT } from '../../common/field-limits';
import { PageQueryDto } from '../../common/dto/pagination.dto';

/** Invoice states an owner filters by on the Invoices page. */
export const INVOICE_STATUSES = [
  'customer_due',
  'paid',
  'payment_verified',
  'payout_approved',
  'in_payout',
  'bill_cleared',
] as const;

export class OwnerInvoicesQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(INVOICE_STATUSES) status?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) q?: string;
}

export class RecordPaymentDto {
  // Money is numeric(12,2): reject sub-paisa precision, and a payment must be > 0.
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() amount!: number;
  // gateway = platform card processing; cash/bkash/bank/online = owner channels (§6).
  @IsIn(['gateway', 'cash', 'bkash', 'bank', 'online'])
  method!: 'gateway' | 'cash' | 'bkash' | 'bank' | 'online';
  @IsOptional() @IsString() @MaxLength(LEN_CODE) gatewayToken?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) receivedBy?: string;
}

export class RefundRequestDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() amount!: number;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) reason?: string;
  /**
   * Encrypted at rest (AES-256-GCM) before storage — see refunds.service.ts.
   * Shape is provider-dependent, so it stays an object rather than a fixed DTO;
   * @IsObject at least rejects scalars and arrays.
   */
  @IsOptional() @IsObject() bankDetails?: Record<string, unknown>;
}

export class CreateCouponDto {
  @IsString() @MaxLength(LEN_CODE) code!: string;
  @IsIn(['percent', 'flat', 'referral']) kind!: 'percent' | 'flat' | 'referral';
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) value!: number;
  @IsOptional() @IsISO8601() validFrom?: string;
  @IsOptional() @IsISO8601() validTo?: string;
  /** Total redemptions allowed across all customers. Omit = unlimited. */
  @IsOptional() @IsInt() @Min(1) maxUses?: number;
  /** Redemptions allowed per customer account. Omit = unlimited. */
  @IsOptional() @IsInt() @Min(1) perUserLimit?: number;
  /** Minimum room total required to apply the coupon. Omit = no minimum. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) minSpend?: number;
}

export class SetCouponActiveDto {
  @IsBoolean() active!: boolean;
}

export class CreatePolicyDto {
  @IsIn(['flexible', 'moderate', 'strict', 'non_refundable', 'custom'])
  policyTemplate!: string;
  @IsOptional() @IsInt() @Min(0) depositPct?: number;
  /** Refund tier table; shape varies by template. */
  @IsOptional() @IsObject() tiers?: Record<string, unknown>;
}

export class RecordDistributionDto {
  @IsString() @MaxLength(LEN_CODE) membershipId!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() amount!: number;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) note?: string;
}

export class IssueSubscriptionDto {
  /** YYYY-MM */
  @IsString() @MaxLength(LEN_CODE) period!: string;
}

/**
 * Query for the distribution-split suggestion.
 *
 * Previously a raw `@Query('amount') amount: string` fed straight into
 * `Number(amount)`: `Number('abc')` is NaN and `Number('')` is 0, so a
 * malformed value silently produced a nonsense split instead of a 400.
 * Primitive @Query params bypass the global ValidationPipe — they need a DTO.
 */
export class SuggestSplitQueryDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;
}
