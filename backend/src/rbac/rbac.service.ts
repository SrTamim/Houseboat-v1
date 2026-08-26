import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../platform/settings/settings.service';
import {
  BoatContext,
  LEGACY_MODULE_PAGES,
  PERM_PAGES,
  PermAction,
  PermModule,
  PermissionMap,
} from './permission.types';

/**
 * Page keys that never named a legacy module. Six keys (bookings, pricing,
 * costs, inventory, reports, settings) name BOTH a legacy module and a page, so
 * they can't disambiguate a map on their own.
 */
const PAGE_ONLY_KEYS = new Set<string>(
  PERM_PAGES.filter((p) => !(p in LEGACY_MODULE_PAGES)),
);

/** The 29 real page keys (what the team UI grants). */
const PAGE_NAMES = new Set<string>(PERM_PAGES);

/**
 * The four legacy module keys that are NOT also the name of a page (assets,
 * trips, money, staff). A page-based role can never contain one, so their
 * presence unambiguously marks a map as legacy-shaped and in need of expansion.
 * Derived as: legacy-module keys minus the six that double as page names.
 */
const LEGACY_ONLY_KEYS = new Set<string>(
  Object.keys(LEGACY_MODULE_PAGES).filter((k) => !PAGE_NAMES.has(k)),
);

/**
 * Expand a stored permission map into effective per-page permissions.
 *
 * A map is expanded only when it is unambiguously LEGACY: it carries a
 * legacy-only key (assets/trips/money/staff — keys no page-based role can hold)
 * and no page-only key. Such a map is what pre-migration roles stored; each
 * legacy key is OR'd onto every page it authorized (via LEGACY_MODULE_PAGES),
 * preserving old access exactly.
 *
 * Every other map — one already carrying a page-only key, or one built purely
 * from the six overlap keys by the page-based team UI — is treated as page-shaped
 * and returned untouched, so per-page grants are never collapsed back into whole
 * groups. The data migration rewrites legacy rows to page keys up front; this
 * shim only covers rows not yet migrated.
 */
export function expandLegacyPermissions(
  stored: PermissionMap | null | undefined,
): PermissionMap {
  if (!stored) return {};

  const keys = Object.keys(stored);
  const hasPageOnly = keys.some((k) => PAGE_ONLY_KEYS.has(k));
  const hasLegacyOnly = keys.some((k) => LEGACY_ONLY_KEYS.has(k));
  const isLegacyShaped = hasLegacyOnly && !hasPageOnly;
  if (!isLegacyShaped) {
    // Page-shaped (or empty) — return a shallow copy, no expansion.
    return { ...stored };
  }

  const out: PermissionMap = {};
  for (const [key, grant] of Object.entries(stored)) {
    if (!grant) continue;
    const targets = LEGACY_MODULE_PAGES[key] ?? [key as keyof PermissionMap];
    for (const page of targets) {
      const cur = out[page] ?? {};
      out[page] = {
        view: Boolean(cur.view || grant.view),
        edit: Boolean(cur.edit || grant.edit),
      };
    }
  }
  return out;
}

/**
 * Days a boat has to clear an unpaid platform bill/due before its owner account
 * is locked out of edits. The account is NOT locked instantly — only after this
 * grace window elapses from the invoice's issue date.
 */
export const BILLING_GRACE_DAYS = 14;

/**
 * Authorization core. Resolves a user's context for a specific boat and checks
 * per-module permissions. Plan §10:
 *  - identity derives from relations, not an account "type"
 *  - every object fetch re-checks authorization (IDOR)
 *  - exited shareholders keep READ access to their period only
 */
@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    // @Optional() so the rbac unit tests construct with only prisma; the billing
    // grace falls back to its constant when the settings service is absent.
    @Optional() private readonly settings?: SettingsService,
  ) {}

  /** Load the caller's active membership + role for this boat, or null. */
  async resolveContext(
    accountId: string,
    houseboatId: string,
  ): Promise<BoatContext | null> {
    const membership = await this.prisma.houseboatMember.findFirst({
      where: { accountId, houseboatId },
      include: { role: true },
      orderBy: { startDate: 'desc' },
    });
    if (!membership) return null;

    return {
      houseboatId,
      membershipId: membership.id,
      roleId: membership.roleId,
      permissions: expandLegacyPermissions(
        membership.role.permissions as PermissionMap,
      ),
      isExited: membership.status === 'exited' || membership.endDate != null,
    };
  }

  /** True if the context grants the given module/action. */
  can(ctx: BoatContext, module: PermModule, action: PermAction): boolean {
    // Exited members are read-only.
    if (action === 'edit' && ctx.isExited) return false;
    const mod = ctx.permissions[module];
    return Boolean(mod && mod[action]);
  }

  /**
   * Assert the account may perform module/action on this boat.
   * Platform staff bypass (they operate cross-boat via a separate path).
   * Throws ForbiddenException otherwise. Returns the resolved context.
   */
  async assert(
    accountId: string,
    isPlatform: boolean,
    houseboatId: string,
    module: PermModule,
    action: PermAction,
    opts?: { bypassBillingLock?: boolean },
  ): Promise<BoatContext | null> {
    if (isPlatform) return null; // platform path; no boat context needed
    const ctx = await this.resolveContext(accountId, houseboatId);
    if (!ctx) {
      throw new ForbiddenException('You have no access to this houseboat');
    }
    if (!this.can(ctx, module, action)) {
      throw new ForbiddenException(
        `Missing ${module}:${action} permission on this houseboat`,
      );
    }
    // Billing lock: once a platform bill/due is unpaid past the 14-day grace,
    // block ALL access to the boat (view and edit) EXCEPT the billing surface,
    // so the owner can still log in, see the bill, and pay to unlock. Callers on
    // the billing/payment path pass bypassBillingLock.
    if (!opts?.bypassBillingLock && (await this.isBillingLocked(houseboatId))) {
      throw new ForbiddenException(
        'This houseboat is locked: an overdue platform bill must be cleared first',
      );
    }
    return ctx;
  }

  /**
   * Like `assert`, but for a route several pages share: the caller passes when
   * they hold `action` on ANY of `pages`. Same platform bypass, exited and
   * billing-lock semantics as `assert`. Used by the guard when a decorator sets
   * `anyOf`.
   */
  async assertAny(
    accountId: string,
    isPlatform: boolean,
    houseboatId: string,
    pages: PermModule[],
    action: PermAction,
    opts?: { bypassBillingLock?: boolean },
  ): Promise<BoatContext | null> {
    if (isPlatform) return null;
    const ctx = await this.resolveContext(accountId, houseboatId);
    if (!ctx) {
      throw new ForbiddenException('You have no access to this houseboat');
    }
    if (!pages.some((p) => this.can(ctx, p, action))) {
      throw new ForbiddenException(
        `Missing ${action} permission on any of: ${pages.join(', ')}`,
      );
    }
    if (!opts?.bypassBillingLock && (await this.isBillingLocked(houseboatId))) {
      throw new ForbiddenException(
        'This houseboat is locked: an overdue platform bill must be cleared first',
      );
    }
    return ctx;
  }

  /**
   * A boat is locked once it has a subscription invoice that is still unpaid AND
   * was issued more than BILLING_GRACE_DAYS ago. Within the grace window the
   * account stays fully usable.
   */
  async isBillingLocked(houseboatId: string): Promise<boolean> {
    const graceDays =
      (await this.settings?.getNumber('billing.graceDays')) ??
      BILLING_GRACE_DAYS;
    const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);
    const overdue = await this.prisma.houseboatSubscriptionInvoice.findFirst({
      where: {
        houseboatId,
        // 'trial' is a $0 marker invoice — it must never lock a boat.
        status: { notIn: ['paid', 'trial'] },
        issuedAt: { lt: cutoff },
      },
      select: { id: true },
    });
    return overdue != null;
  }

  /** List boats the account is a member of — for the boat switcher. */
  async listBoats(accountId: string) {
    const memberships = await this.prisma.houseboatMember.findMany({
      where: { accountId, status: 'active' },
      include: {
        houseboat: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            // Drives the console's default-boat pick: it prefers a live boat
            // that already has a weekly schedule so a freshly-added empty boat
            // never hijacks the landing and looks like a broken console.
            _count: { select: { schedules: { where: { active: true } } } },
          },
        },
        role: { select: { name: true, permissions: true } },
      },
      // Stable order so the console's default-boat pick is deterministic rather
      // than following Postgres' physical row order.
      orderBy: { houseboat: { name: 'asc' } },
    });
    // Dedupe by boat: an account should have at most one active membership per
    // boat (enforced by uq_member_active), but a stray legacy duplicate must
    // never surface two rows for one boat — that crashes the boat switcher/login
    // list on a duplicate React key. Keep the first (memberships are ordered by
    // boat name; ties resolve to whichever the DB returned first).
    const seen = new Set<string>();
    const boats = [];
    for (const m of memberships) {
      if (seen.has(m.houseboatId)) continue;
      seen.add(m.houseboatId);
      boats.push({
        houseboatId: m.houseboatId,
        name: m.houseboat.name,
        slug: m.houseboat.slug,
        status: m.houseboat.status,
        role: m.role.name,
        hasSchedule: m.houseboat._count.schedules > 0,
        // Effective per-page permissions for the console's sidebar filter and
        // page guard. Legacy roles are expanded to page keys here.
        permissions: expandLegacyPermissions(m.role.permissions as PermissionMap),
        // Members listed here are status:active; an active row with an endDate is
        // read-only for its period.
        isExited: m.endDate != null,
      });
    }
    return boats;
  }
}
