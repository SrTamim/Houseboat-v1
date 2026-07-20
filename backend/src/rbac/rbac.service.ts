import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BoatContext,
  PermAction,
  PermModule,
  PermissionMap,
} from './permission.types';

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
  constructor(private readonly prisma: PrismaService) {}

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
      permissions: (membership.role.permissions as PermissionMap) ?? {},
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
   * A boat is locked once it has a subscription invoice that is still unpaid AND
   * was issued more than BILLING_GRACE_DAYS ago. Within the grace window the
   * account stays fully usable.
   */
  async isBillingLocked(houseboatId: string): Promise<boolean> {
    const cutoff = new Date(
      Date.now() - BILLING_GRACE_DAYS * 24 * 60 * 60 * 1000,
    );
    const overdue = await this.prisma.houseboatSubscriptionInvoice.findFirst({
      where: {
        houseboatId,
        status: { not: 'paid' },
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
        houseboat: { select: { id: true, name: true, slug: true, status: true } },
        role: { select: { name: true } },
      },
    });
    return memberships.map((m) => ({
      houseboatId: m.houseboatId,
      name: m.houseboat.name,
      slug: m.houseboat.slug,
      status: m.houseboat.status,
      role: m.role.name,
    }));
  }
}
