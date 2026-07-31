import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQueryDto } from '../../common/dto/pagination.dto';

/** Runtime mirror of InvoiceStatus (money/invoice-state.ts exports a type only). */
export const INVOICE_STATUSES = [
  'customer_due',
  'paid',
  'payment_verified',
  'in_payout',
  'bill_cleared',
  'cancelled',
  'refund_requested',
  'refund_verified',
  'refund_completed',
] as const;

export const BOOKING_STATUSES = [
  'confirmed',
  'rescheduled',
  'cancelled',
  'not_arrived',
  'completed',
] as const;

export const REFUND_STATUSES = ['requested', 'verified', 'completed'] as const;

export const SUBSCRIPTION_STATUSES = ['issued', 'paid', 'overdue'] as const;

/** Toggle a platform-curated route on or off. */
export class SetRouteActiveDto {
  @IsBoolean() active!: boolean;
}

/** Payout batches, optionally narrowed to one boat. */
export class ListPayoutBatchesQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() houseboatId?: string;
}

/** Waitlist entries, optionally narrowed to one departure. */
export class ListWaitlistQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() departureId?: string;
}

/** Invoices across all boats, optionally narrowed by state or boat. */
export class ListInvoicesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(INVOICE_STATUSES as unknown as string[])
  status?: (typeof INVOICE_STATUSES)[number];

  @IsOptional() @IsUUID() houseboatId?: string;
}

/** Bookings across all boats. Boat filter goes through departure → package. */
export class ListBookingsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(BOOKING_STATUSES as unknown as string[])
  status?: (typeof BOOKING_STATUSES)[number];

  @IsOptional() @IsUUID() houseboatId?: string;
}

export class ListReviewsQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() houseboatId?: string;
}

/** Accounts, optionally filtered by a name/phone/email search term. */
export class ListAccountsQueryDto extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}

export class ListMembershipsQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() houseboatId?: string;

  @IsOptional()
  @IsIn(['active', 'exited'])
  status?: 'active' | 'exited';
}

export class ListRefundsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(REFUND_STATUSES as unknown as string[])
  status?: (typeof REFUND_STATUSES)[number];
}

export class ListCreditsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['open', 'used'])
  status?: 'open' | 'used';
}

export class ListSubscriptionInvoicesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES as unknown as string[])
  status?: (typeof SUBSCRIPTION_STATUSES)[number];

  @IsOptional() @IsUUID() houseboatId?: string;
}

export class ListCouponsQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() houseboatId?: string;
}

export class ListReschedulesQueryDto extends PageQueryDto {}

/** Per-boat roles, optionally narrowed to one boat. */
export class ListRolesQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() houseboatId?: string;
}

/**
 * Platform-set billing terms for one boat. PUT semantics: an absent or null
 * field clears to NULL — "not on commission" / "no monthly fee" are legitimate
 * states (schema comment on HouseboatBillingConfig). platform_balance is
 * deliberately NOT here: it is a ledger value owned by the payout and
 * subscription-payment paths.
 */
export class UpsertBillingConfigDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionPct?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyFee?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  gatewayFeePct?: number | null;

  /** YYYY-MM-DD — the column is a date, not a timestamp. */
  @IsOptional()
  @IsISO8601()
  trialEnds?: string | null;
}

export class ListNotificationsQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(['sms', 'email']) channel?: 'sms' | 'email';

  /** 'true' | 'false' — @Query params arrive as strings. */
  @IsOptional() @IsIn(['true', 'false']) delivered?: string;
}

/**
 * Audit log browse. Not cursor-paginated like the others: audit_log's PK is
 * composite (id, server_time) because of partitioning, so Prisma's
 * `cursor: { id }` cannot address a row. `before` (ISO timestamp) pages by
 * server_time instead.
 */
export class ListAuditQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() houseboatId?: string;

  @IsOptional() @IsString() @MaxLength(100) action?: string;

  @IsOptional() @IsISO8601() before?: string;
}
