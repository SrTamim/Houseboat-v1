import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LEN_CODE, LEN_NAME } from '../../common/field-limits';
import { MAX_PAGE_SIZE } from '../../common/paginate';

/** YYYY-MM. Anchors calendar, reports and earnings to one month. */
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export class MonthQueryDto {
  @IsOptional()
  @Matches(MONTH_RE, { message: 'month must be YYYY-MM' })
  month?: string;
}

export class MonthlyReportQueryDto {
  /** How many months back to summarise, ending with the current one. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) months?: number;
}

export class FinancialsQueryDto {
  /** 1–12. Omit for the current month. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) month?: number;
  /**
   * Calendar year. Omit (with `month` set) to sum that month across every year
   * on record — the "every January" seasonality view.
   */
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year?: number;
}

export class GuestsQueryDto {
  @IsOptional() @IsString() @MaxLength(LEN_NAME) q?: string;
  /**
   * Offset paging, not a cursor: the guest list is a groupBy aggregate and
   * Prisma cursors don't apply to grouped rows. Guest counts per boat are
   * small (hundreds), so the offset scan cost is not a concern here.
   */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_PAGE_SIZE) limit?: number;
}

export class AuditQueryDto {
  @IsOptional() @IsString() @MaxLength(LEN_CODE) action?: string;
  /**
   * Keyset cursor: "<serverTime ISO>|<id>". audit_log is partitioned by month
   * with a composite PK, so the generic id-only cursor in common/paginate
   * cannot address a row uniquely.
   */
  @IsOptional() @IsString() @MaxLength(128) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_PAGE_SIZE) limit?: number;
}

export class MySettingsDto {
  /**
   * Free-form per-event toggles: {"booking":true,"payment_due":false,…}.
   * Kept open so adding a notification type needs no migration; the UI owns
   * the list of keys it renders.
   */
  @IsOptional() notificationPrefs?: Record<string, boolean>;
}
