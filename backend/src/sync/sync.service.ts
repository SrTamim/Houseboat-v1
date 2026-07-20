import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { OpsService } from '../ops/ops.service';
import { AuditService } from '../audit/audit.service';
import { OfflineAction, SyncIntentDto } from './dto/sync.dto';
import { PermModule } from '../rbac/permission.types';
import { newId } from '../common/uuid';

export interface IntentResult {
  intentId: string;
  status: 'applied' | 'duplicate' | 'unauthorized' | 'conflict' | 'error';
  message?: string;
}

/**
 * Offline replay (plan §6). Each queued action is an append-only INTENT, not a
 * state overwrite. On reconnect we:
 *  1. Re-authorize every action against the actor's permissions AS OF device_time
 *     (a fired manager's queued actions must not apply).
 *  2. Dedupe by intentId → same intent applied twice is idempotent (both logged).
 *  3. Route failures to a conflict queue for admin review, never silently drop.
 *
 * server_time is authoritative; a manipulated device clock can reorder but
 * never erase.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  // Maps an offline action to the permission module it needs.
  private readonly actionModule: Record<OfflineAction, PermModule> = {
    cost_add: 'costs',
    stock_movement: 'inventory',
    mark_cash_paid: 'money',
    mark_not_arrived: 'bookings',
    date_change: 'bookings',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly ops: OpsService,
    private readonly audit: AuditService,
  ) {}

  async replay(
    accountId: string,
    isPlatform: boolean,
    intents: SyncIntentDto[],
  ): Promise<{ summary: string; results: IntentResult[] }> {
    const results: IntentResult[] = [];

    for (const intent of intents) {
      try {
        // 1. Idempotency: has this intent already been applied? We record each
        //    applied intent in audit_log with entityId = intentId.
        const seen = await this.prisma.auditLog.findFirst({
          where: { entityType: 'sync_intent', entityId: intent.intentId },
        });
        if (seen) {
          results.push({ intentId: intent.intentId, status: 'duplicate' });
          continue;
        }

        // 2. Re-authorize AS OF device_time — membership must have been active
        //    (and not exited) at that moment.
        const deviceTime = new Date(intent.deviceTime);
        const authorized = await this.wasAuthorized(
          accountId,
          isPlatform,
          intent.houseboatId,
          intent.action,
          deviceTime,
        );
        if (!authorized) {
          await this.queueConflict(accountId, intent, 'unauthorized_at_device_time');
          results.push({
            intentId: intent.intentId,
            status: 'unauthorized',
            message: 'Not authorized as of device_time',
          });
          continue;
        }

        // 3. Apply the action.
        await this.applyIntent(accountId, intent, deviceTime);
        results.push({ intentId: intent.intentId, status: 'applied' });
      } catch (e) {
        await this.queueConflict(accountId, intent, String(e));
        results.push({
          intentId: intent.intentId,
          status: 'error',
          message: (e as Error).message,
        });
      }
    }

    const applied = results.filter((r) => r.status === 'applied').length;
    const needsReview = results.filter(
      (r) => r.status === 'unauthorized' || r.status === 'conflict' || r.status === 'error',
    ).length;
    const summary = `${applied} action(s) synced${
      needsReview ? `, ${needsReview} need review` : ''
    }`;
    return { summary, results };
  }

  /** Was the account allowed to do this action on this boat at device_time? */
  private async wasAuthorized(
    accountId: string,
    isPlatform: boolean,
    houseboatId: string,
    action: OfflineAction,
    at: Date,
  ): Promise<boolean> {
    if (isPlatform) return true;
    const membership = await this.prisma.houseboatMember.findFirst({
      where: {
        accountId,
        houseboatId,
        startDate: { lte: at },
        OR: [{ endDate: null }, { endDate: { gte: at } }],
      },
      include: { role: true },
    });
    if (!membership) return false;
    const perms = (membership.role.permissions ?? {}) as Record<
      string,
      { edit?: boolean }
    >;
    const module = this.actionModule[action];
    return Boolean(perms[module]?.edit);
  }

  private async applyIntent(
    accountId: string,
    intent: SyncIntentDto,
    deviceTime: Date,
  ): Promise<void> {
    const p = intent.payload;
    switch (intent.action) {
      case 'cost_add':
        await this.ops.addCost(intent.houseboatId, accountId, {
          date: (p.date as string) ?? deviceTime.toISOString(),
          description: p.description as string,
          amount: Number(p.amount),
          tripId: p.tripId as string | undefined,
        });
        break;
      case 'stock_movement': {
        const itemId = p.itemId as string;
        await this.assertEntityBoat('inventory_item', itemId, intent.houseboatId);
        await this.ops.recordMovement(itemId, accountId, {
          direction: p.direction as 'in' | 'out' | 'count',
          qty: Number(p.qty),
          tripId: p.tripId as string | undefined,
        });
        break;
      }
      case 'mark_cash_paid': {
        // Cross-boat guard: the invoice must belong to the intent's boat, not
        // just any boat this actor happens to be authorized on.
        const invoiceId = p.invoiceId as string;
        await this.assertEntityBoat('invoice', invoiceId, intent.houseboatId);
        // Delegated to payments in a fuller build; recorded here for audit.
        await this.prisma.invoicePayment.create({
          data: {
            id: newId(),
            invoiceId,
            amount: Number(p.amount),
            method: 'cash',
            receivedBy: accountId,
            paidAt: deviceTime,
          },
        });
        break;
      }
      case 'mark_not_arrived': {
        const bookingId = p.bookingId as string;
        await this.assertEntityBoat('booking', bookingId, intent.houseboatId);
        await this.prisma.booking.update({
          where: { id: bookingId },
          data: { status: 'not_arrived' },
        });
        break;
      }
      case 'date_change': {
        const departureId = p.departureId as string;
        await this.assertEntityBoat('departure', departureId, intent.houseboatId);
        await this.prisma.tripDeparture.update({
          where: { id: departureId },
          data: { startDate: new Date(p.startDate as string) },
        });
        break;
      }
    }

    // Record the applied intent (append-only) with device + server time.
    await this.audit.log({
      houseboatId: intent.houseboatId,
      actorAccountId: accountId,
      action: intent.action,
      entityType: 'sync_intent',
      entityId: intent.intentId,
      after: intent.payload,
      deviceTime,
      syncedOffline: true,
    });
  }

  /**
   * Cross-boat guard for replayed intents. Authorization (wasAuthorized) proves
   * the actor could act on intent.houseboatId — but the payload also names a
   * target entity by id. Verify that entity actually belongs to that boat, or a
   * Boat-A member could drive a mutation on Boat-B's invoice/booking/departure.
   */
  private async assertEntityBoat(
    kind: 'invoice' | 'booking' | 'departure' | 'inventory_item',
    entityId: string,
    houseboatId: string,
  ): Promise<void> {
    let boatId: string | null | undefined;
    switch (kind) {
      case 'invoice': {
        const inv = await this.prisma.invoice.findUnique({
          where: { id: entityId },
          select: { houseboatId: true },
        });
        boatId = inv?.houseboatId;
        break;
      }
      case 'inventory_item': {
        const item = await this.prisma.inventoryItem.findUnique({
          where: { id: entityId },
          select: { houseboatId: true },
        });
        boatId = item?.houseboatId;
        break;
      }
      case 'booking': {
        const b = await this.prisma.booking.findUnique({
          where: { id: entityId },
          select: { departure: { select: { package: { select: { houseboatId: true } } } } },
        });
        boatId = b?.departure?.package?.houseboatId;
        break;
      }
      case 'departure': {
        const d = await this.prisma.tripDeparture.findUnique({
          where: { id: entityId },
          select: { package: { select: { houseboatId: true } } },
        });
        boatId = d?.package?.houseboatId;
        break;
      }
    }
    if (!boatId) {
      throw new Error(`${kind} ${entityId} not found`);
    }
    if (boatId !== houseboatId) {
      throw new Error(
        `${kind} ${entityId} does not belong to boat ${houseboatId}`,
      );
    }
  }

  /** Different-intent conflicts and failures go here for a human. */
  private async queueConflict(
    accountId: string,
    intent: SyncIntentDto,
    reason: string,
  ): Promise<void> {
    await this.audit.log({
      houseboatId: intent.houseboatId,
      actorAccountId: accountId,
      action: 'sync_conflict',
      entityType: 'sync_intent',
      entityId: `${intent.intentId}:conflict`,
      after: { reason, action: intent.action, payload: intent.payload },
      deviceTime: new Date(intent.deviceTime),
      syncedOffline: true,
    });
  }
}
