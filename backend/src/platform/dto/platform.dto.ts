import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PageQueryDto } from '../../common/dto/pagination.dto';

/** Runtime mirror of InvoiceStatus (money/invoice-state.ts exports a type only). */
export const INVOICE_STATUSES = [
  'customer_due',
  'paid',
  'payment_verified',
  'payout_approved',
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

export const SUBSCRIPTION_STATUSES = [
  'issued',
  'paid',
  'overdue',
  'trial',
] as const;

/** Toggle a platform-curated route on or off. */
export class SetRouteActiveDto {
  @IsBoolean() active!: boolean;
}

/** Edit a platform-curated route's display fields (name/region). */
export class UpdateRouteDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;

  /** null clears the region; an absent field leaves it unchanged. */
  @IsOptional() @IsString() @MaxLength(120) region?: string | null;
}

/** Set one operational setting. Value bounds are enforced in SettingsService. */
export class UpdateSettingDto {
  @IsInt() value!: number;
}

/** Hide or unhide a review (platform moderation). */
export class SetReviewHiddenDto {
  @IsBoolean() hidden!: boolean;
}

/** Payout batches, optionally narrowed to one boat. */
export class ListPayoutBatchesQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() houseboatId?: string;
}

/** Which boats to list in the payout dropdowns. */
export class PayableBoatsQueryDto {
  /** 'approve' = boats with invoices in the approve queue; 'pay' = boats with approved invoices. */
  @IsOptional() @IsIn(['approve', 'pay']) stage?: 'approve' | 'pay';
}

/** Pay a selected set of one boat's approved invoices to the vendor. */
export class PayInvoicesDto {
  @IsUUID() houseboatId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  invoiceIds!: string[];
}

/** Past payout receipts, optionally searched by boat name / receipt id. */
export class ListPayoutReceiptsQueryDto extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
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

  /**
   * Invoices ready to settle: owner-recorded 'paid' plus platform-verified
   * 'payment_verified', not yet in a payout batch. Backs the payout-prep queue
   * (mirrors payouts.service.ts pickup). Ignored when `status` is set.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  settleable?: boolean;

  /**
   * The gateway verify queue: 'paid' invoices carrying a gateway payment the
   * platform still checks against the gateway portal. Owner-recorded cash never
   * queues here — it settles without platform verification. Ignored when
   * `status` is set.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  gatewayPending?: boolean;

  /**
   * The payout console queue: unbatched invoices in 'paid' / 'payment_verified'
   * / 'payout_approved', narrowed to fully-paid, completed-trip invoices. Backs
   * the Payouts (approve) page. Ignored when `status` is set.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  payoutQueue?: boolean;

  @IsOptional() @IsUUID() houseboatId?: string;

  /**
   * Only invoices whose trip the owner cancelled (`departure.status='cancelled'`).
   * These keep invoice status 'paid' until the customer requests a refund, so this
   * is the only way to list them. ANDs with the other predicates.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  departureCancelled?: boolean;

  /** Free-text: matches customer name / phone, boat name, or a booking id prefix. */
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}

/** Bookings across all boats. Boat filter goes through departure → package. */
export class ListBookingsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(BOOKING_STATUSES as unknown as string[])
  status?: (typeof BOOKING_STATUSES)[number];

  @IsOptional() @IsUUID() houseboatId?: string;

  /** Free-text: matches customer name / phone, or a booking id prefix. */
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}

export class ListReviewsQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() houseboatId?: string;

  /** Free-text: matches review text, customer name, or boat name. */
  @IsOptional() @IsString() @MaxLength(100) q?: string;

  /** 'true' | 'false' — filter to hidden or visible reviews. Absent = all. */
  @IsOptional() @IsIn(['true', 'false']) hidden?: string;
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

  /** Free-text: matches member name / phone, or boat name. */
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}

export class ListRefundsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(REFUND_STATUSES as unknown as string[])
  status?: (typeof REFUND_STATUSES)[number];
}

export class ListCreditsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['open', 'used', 'pending_cashout'])
  status?: 'open' | 'used' | 'pending_cashout';
}

export class ListCashoutsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';
}

export class ListSubscriptionInvoicesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES as unknown as string[])
  status?: (typeof SUBSCRIPTION_STATUSES)[number];

  @IsOptional() @IsUUID() houseboatId?: string;

  /** Free-text: matches boat name or billing period. */
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}

export class ListCouponsQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() houseboatId?: string;

  /** Free-text: matches coupon code or boat name. */
  @IsOptional() @IsString() @MaxLength(100) q?: string;

  @IsOptional() @IsIn(['percent', 'flat', 'referral']) kind?: string;
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

  /** Free-text: matches action, or the actor's name / phone. */
  @IsOptional() @IsString() @MaxLength(100) q?: string;

  /** Only entries at or after this instant (pairs with `before` for a range). */
  @IsOptional() @IsISO8601() after?: string;

  /**
   * 'true' (default on the admin audit page) restricts to actions by platform
   * staff — the closest proxy for "admin panel activity", since AuditLog has no
   * actor-role column. 'false'/absent returns all actors.
   */
  @IsOptional() @IsIn(['true', 'false']) platformOnly?: string;
}
