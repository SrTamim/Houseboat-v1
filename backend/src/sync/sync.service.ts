import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { OpsService } from '../ops/ops.service';
import { AuditService } from '../audit/audit.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { OwnerBookingsService } from '../booking/owner-bookings.service';
import { PaymentsService } from '../money/payments.service';
import { TripsService } from '../trips/trips.service';
import { OfflineAction, SyncIntentDto } from './dto/sync.dto';
import { PermPage, PermissionMap } from '../rbac/permission.types';
import { expandLegacyPermissions } from '../rbac/rbac.service';

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

  // Maps an offline action to the permission PAGE it needs. Mirrors the
  // re-tagged @RequirePermission on the online routes each action replays:
  // check-ins are a `departure` action, maintenance is its own page, cash
  // payments and date changes are `bookings` (see BookingService).
  private readonly actionModule: Record<OfflineAction, PermPage> = {
    cost_add: 'costs',
    stock_movement: 'inventory',
    mark_cash_paid: 'bookings',
    mark_not_arrived: 'departure',
    date_change: 'bookings',
    maintenance_request: 'maintenance',
    checkin_set: 'departure',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly ops: OpsService,
    private readonly audit: AuditService,
    private readonly maintenance: MaintenanceService,
    private readonly bookings: OwnerBookingsService,
    private readonly payments: PaymentsService,
    private readonly trips: TripsService,
  ) {}

  async replay(
    accountId: string,
    isPlatform: boolean,
    intents: SyncIntentDto[],
  ): Promise<{ summary: string; results: IntentResult[] }> {
    const results: IntentResult[] = [];

    for (const intent of intents) {
      // 1. Idempotency claim. Insert the intentId into the dedupe ledger BEFORE
      //    doing anything: the unique PK makes a duplicate or a concurrent replay
      //    of the same intentId fail atomically (P2002), so a money action can
      //    never apply twice. This replaces the old non-atomic find-then-apply
      //    (two overlapping batches both passed the read and both applied).
      //    audit_log is partitioned on server_time and cannot hold a unique index
      //    on intentId, hence this dedicated ledger. If the action then fails, we
      //    release the claim (below) so a genuine re-sync can retry.
      try {
        await this.prisma.syncIntentApplied.create({
          data: {
            intentId: intent.intentId,
            accountId,
            houseboatId: intent.houseboatId,
            action: intent.action,
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          results.push({ intentId: intent.intentId, status: 'duplicate' });
          continue;
        }
        throw e;
      }

      try {
        // 2. Re-authorize AS OF device_time — membership must have been active
        //    (and not exited) at that moment.
        const deviceTime = new Date(intent.deviceTime);
        const authorized = await this.wasAuthorized(
          accountId,
          isPlatform,
          intent.houseboatId,
          intent.action,
          deviceTime,
          new Date(), // server-received time — device_time cannot be trusted alone
        );
        if (!authorized) {
          // Release the claim — the action did not apply, so a re-authorized
          // retry (rare) or an audit re-run must not be blocked as a duplicate.
          await this.releaseClaim(intent.intentId);
          await this.queueConflict(accountId, intent, 'unauthorized_at_device_time');
          results.push({
            intentId: intent.intentId,
            status: 'unauthorized',
            message: 'Not authorized as of device_time',
          });
          continue;
        }

        // 3. Apply the action.
        await this.applyIntent(accountId, isPlatform, intent, deviceTime);
        results.push({ intentId: intent.intentId, status: 'applied' });
      } catch (e) {
        // The action failed AFTER we claimed the intentId. Release the claim so
        // the operator's retry isn't silently swallowed as a duplicate; the
        // conflict queue still records it for review.
        await this.releaseClaim(intent.intentId);
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

  /**
   * Was the account allowed to do this action on this boat?
   *
   * Membership must have been active at device_time AND still be active at the
   * server-received time. device_time is client-supplied and manipulable, so
   * checking it alone let a fired/exited manager backdate device_time into their
   * old membership window and replay mutations (audit S-M3). Requiring current
   * validity too closes that: a lapsed membership is refused regardless of the
   * timestamp the device claims.
   */
  private async wasAuthorized(
    accountId: string,
    isPlatform: boolean,
    houseboatId: string,
    action: OfflineAction,
    at: Date,
    receivedAt: Date,
  ): Promise<boolean> {
    if (isPlatform) return true;
    const membership = await this.prisma.houseboatMember.findFirst({
      where: {
        accountId,
        houseboatId,
        // Active at BOTH the claimed device time and the actual replay time.
        startDate: { lte: at },
        AND: [
          { OR: [{ endDate: null }, { endDate: { gte: at } }] },
          { startDate: { lte: receivedAt } },
          { OR: [{ endDate: null }, { endDate: { gte: receivedAt } }] },
        ],
      },
      include: { role: true },
    });
    if (!membership) return false;
    // Expand legacy module keys to pages so an un-migrated role authorizes the
    // page-keyed action, matching how online routes resolve permissions.
    const perms = expandLegacyPermissions(
      (membership.role.permissions as PermissionMap) ?? {},
    );
    const page = this.actionModule[action];
    return Boolean(perms[page]?.edit);
  }

  private async applyIntent(
    accountId: string,
    isPlatform: boolean,
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
        await this.ops.recordMovement(intent.houseboatId, itemId, accountId, {
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
        // Route through the real payments path (audit #6/F18) so the invoice's
        // amountPaid/status actually advance under a row lock with the overpay +
        // payout-freeze guards — a raw invoicePayment insert left the invoice
        // showing unpaid (cash invisible, double-collectible). recordPayment
        // re-asserts bookings:edit at replay time; on a payout-frozen invoice it
        // throws, which the replay loop catches and queues as a conflict — the
        // correct outcome for a late offline cash payment. Cash is excluded from
        // payout receipts (dueForInvoice filters gateway), so settling here does
        // not affect what the boat is paid.
        await this.payments.recordPayment(invoiceId, accountId, isPlatform, {
          amount: Number(p.amount),
          method: 'cash',
          receivedBy: accountId,
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
        // Route through the online updateDeparture (audit #11/F20) so the same
        // guards apply: a date change is REFUSED when the departure has active
        // bookings (a raw update silently rescheduled confirmed guests and
        // re-anchored their cancellation window), the new date must be an
        // operating date, and endDate is recomputed from the package duration.
        await this.trips.updateDeparture(
          intent.houseboatId,
          departureId,
          { startDate: p.startDate as string },
          accountId,
        );
        break;
      }
      case 'checkin_set': {
        // setCheckin already scopes its lookup to houseboatId (cross-boat safe)
        // and writes its own booking audit row.
        await this.bookings.setCheckin(
          intent.houseboatId,
          p.bookingId as string,
          accountId,
          p.status as 'pending' | 'checked_in' | 'absent',
        );
        break;
      }
      case 'maintenance_request': {
        // payload.op discriminates create vs update; both reuse the maintenance
        // service so ticket audit + comment side-effects stay consistent.
        if (p.op === 'update') {
          const requestId = p.requestId as string;
          await this.assertEntityBoat(
            'maintenance_request',
            requestId,
            intent.houseboatId,
          );
          await this.maintenance.updateRequest(
            intent.houseboatId,
            requestId,
            accountId,
            {
              topic: p.topic as string | undefined,
              urgency: p.urgency as 'low' | 'medium' | 'high' | undefined,
              status: p.status as
                | 'pending'
                | 'in_progress'
                | 'complete'
                | 'canceled'
                | undefined,
              comment: p.comment as string | undefined,
            },
          );
        } else {
          await this.maintenance.createRequest(intent.houseboatId, accountId, {
            topic: p.topic as string,
            urgency: p.urgency as 'low' | 'medium' | 'high',
            comment: p.comment as string | undefined,
          });
        }
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
    kind:
      | 'invoice'
      | 'booking'
      | 'departure'
      | 'inventory_item'
      | 'maintenance_request',
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
      case 'maintenance_request': {
        const r = await this.prisma.maintenanceRequest.findUnique({
          where: { id: entityId },
          select: { houseboatId: true },
        });
        boatId = r?.houseboatId;
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
  /**
   * Release a dedupe claim after the action failed to apply, so a legitimate
   * re-sync of the same intentId isn't rejected as a duplicate. Best-effort: if
   * the delete itself fails the worst case is the intent can't be retried (it
   * still shows in the conflict queue for manual handling), never a double-apply.
   */
  private async releaseClaim(intentId: string): Promise<void> {
    await this.prisma.syncIntentApplied
      .delete({ where: { intentId } })
      .catch(() => undefined);
  }

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
