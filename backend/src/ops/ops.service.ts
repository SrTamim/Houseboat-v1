import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { newId } from '../common/uuid';
import { money, add, sub } from '../common/money';
import {
  CreateCostDto,
  UpdateCostDto,
  CreateInventoryItemDto,
  StockMovementDto,
  CreateReviewDto,
} from './dto/ops.dto';

/**
 * Ops — costs, inventory, reviews, notifications (plan §9, §Ops).
 *  - Cost: one row, no forced category, paid_by auto from login.
 *  - Consumables: out movement decrements qty; below reorder_threshold → notify.
 *  - Durables: owner runs a count; discrepancy = expected − actual; >0 is missing.
 *  - Reviews: only from verified completed bookings.
 */
@Injectable()
export class OpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Notify active members of a boat (best-effort) about an event. */
  private async notifyBoatMembers(
    houseboatId: string,
    event: string,
    subject: string,
    message: string,
  ): Promise<void> {
    const members = await this.prisma.houseboatMember.findMany({
      where: { houseboatId, status: 'active' },
      select: { account: { select: { id: true, phone: true, email: true } } },
    });
    await Promise.all(
      members.map((m) =>
        this.notifications.notify({
          accountId: m.account.id,
          event,
          to: { phone: m.account.phone ?? undefined, email: m.account.email ?? undefined },
          subject,
          message,
        }),
      ),
    );
  }

  // ── Costs ──────────────────────────────────────────────────
  async addCost(houseboatId: string, actorId: string, dto: CreateCostDto) {
    const cost = await this.prisma.cost.create({
      data: {
        id: newId(),
        houseboatId,
        date: new Date(dto.date),
        description: dto.description,
        amount: dto.amount,
        tripId: dto.tripId,
        paidBy: actorId, // auto-captured from the logged-in user
        comment: dto.comment,
      },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'cost_add',
      entityType: 'cost',
      entityId: cost.id,
    });
    return cost;
  }

  /** Edit a logged cost — owner/crew corrections (§9). */
  async updateCost(
    houseboatId: string,
    actorId: string,
    costId: string,
    dto: UpdateCostDto,
  ) {
    const existing = await this.prisma.cost.findFirst({
      where: { id: costId, houseboatId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Cost not found');

    const cost = await this.prisma.cost.update({
      where: { id: costId },
      data: {
        ...(dto.date !== undefined ? { date: new Date(dto.date) } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.tripId !== undefined ? { tripId: dto.tripId } : {}),
        ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
      },
      include: { paidByAccount: { select: { name: true } } },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'cost_edit',
      entityType: 'cost',
      entityId: cost.id,
    });
    return cost;
  }

  listCosts(houseboatId: string) {
    return this.prisma.cost.findMany({
      where: { houseboatId },
      orderBy: { date: 'desc' },
      include: { paidByAccount: { select: { name: true } } },
    });
  }

  // ── Inventory ──────────────────────────────────────────────
  addItem(houseboatId: string, dto: CreateInventoryItemDto) {
    return this.prisma.inventoryItem.create({
      data: {
        id: newId(),
        houseboatId,
        name: dto.name,
        kind: dto.kind,
        unit: dto.unit,
        reorderThreshold: dto.reorderThreshold,
        currentQty: dto.currentQty ?? 0,
      },
    });
  }

  async listItems(houseboatId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { houseboatId },
    });
    const durableIds = items.filter((i) => i.kind === 'durable').map((i) => i.id);
    if (durableIds.length === 0) return items;

    // Latest 'count' movement per durable — no DISTINCT ON in Prisma, so pull
    // them newest-first and keep the first seen for each item.
    const counts = await this.prisma.stockMovement.findMany({
      where: { inventoryItemId: { in: durableIds }, direction: 'count' },
      orderBy: { at: 'desc' },
      select: {
        inventoryItemId: true,
        qty: true,
        expectedQty: true,
        discrepancy: true,
        at: true,
      },
    });
    const latest = new Map<string, (typeof counts)[number]>();
    for (const c of counts) {
      if (!latest.has(c.inventoryItemId)) latest.set(c.inventoryItemId, c);
    }

    return items.map((i) => {
      const c = latest.get(i.id);
      return c
        ? {
            ...i,
            lastCount: {
              countedQty: c.qty,
              expectedQty: c.expectedQty,
              discrepancy: c.discrepancy,
              at: c.at,
            },
          }
        : i;
    });
  }

  /**
   * Record a stock movement. 'out' decrements qty (consumables);
   * 'in' increments; 'count' compares actual against expected (durables) and
   * records the discrepancy. Returns a low-stock flag for consumables.
   */
  async recordMovement(
    itemId: string,
    actorId: string,
    dto: StockMovementDto,
  ) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Inventory item not found');

    const result = await this.prisma.$transaction(async (tx) => {
      let expectedQty: number | undefined;
      let discrepancy: number | undefined;
      let newQty = money(item.currentQty);

      if (dto.direction === 'out') {
        newQty = sub(newQty, money(dto.qty));
      } else if (dto.direction === 'in') {
        newQty = add(newQty, money(dto.qty));
      } else {
        // count: expected = what we believed; actual = dto.qty
        expectedQty = Number(item.currentQty);
        discrepancy = expectedQty - dto.qty; // >0 → something missing
        newQty = money(dto.qty); // count sets the truth
      }

      const movement = await tx.stockMovement.create({
        data: {
          id: newId(),
          inventoryItemId: itemId,
          tripId: dto.tripId,
          direction: dto.direction,
          qty: dto.qty,
          expectedQty,
          discrepancy,
          loggedBy: actorId,
        },
      });

      await tx.inventoryItem.update({
        where: { id: itemId },
        data: { currentQty: newQty },
      });

      const lowStock =
        item.kind === 'consumable' &&
        item.reorderThreshold != null &&
        newQty.lessThan(money(item.reorderThreshold));

      if (lowStock) {
        await this.audit.log(
          {
            houseboatId: item.houseboatId,
            actorAccountId: actorId,
            action: 'low_stock',
            entityType: 'inventory_item',
            entityId: itemId,
          },
          tx,
        );
      }

      return {
        movement,
        currentQty: newQty.toFixed(2),
        lowStock,
        discrepancy,
      };
    });

    // Fan-out low-stock notice AFTER commit — side effects must not fire on a
    // rolled-back transaction.
    if (result.lowStock) {
      await this.notifyBoatMembers(
        item.houseboatId,
        'low_stock',
        `Low stock: ${item.name}`,
        `${item.name} is below its reorder threshold (now ${result.currentQty}).`,
      ).catch(() => undefined);
    }

    return result;
  }

  // ── Reviews (verified completed bookings only) ─────────────
  async addReview(bookingId: string, customerId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { invoice: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('You can only review your own booking');
    }
    if (booking.status !== 'completed') {
      throw new BadRequestException('Only completed trips can be reviewed');
    }
    // "paid" = payment recorded and settling (owner-recorded cash, or a
    // platform-verified gateway payment, and anything downstream).
    const verifiedStates = ['paid', 'payment_verified', 'in_payout', 'bill_cleared'];
    if (!booking.invoice || !verifiedStates.includes(booking.invoice.status)) {
      throw new BadRequestException('Only verified bookings can be reviewed');
    }

    return this.prisma.review.create({
      data: {
        id: newId(),
        bookingId,
        houseboatId: booking.invoice.houseboatId,
        customerId,
        rating: dto.rating,
        text: dto.text,
      },
    });
  }

  listReviews(houseboatId: string) {
    return this.prisma.review.findMany({
      where: { houseboatId },
      orderBy: { id: 'desc' },
    });
  }

  /** Create or edit the owner's reply to a review (§7). */
  replyToReview(reviewId: string, reply: string) {
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { ownerReply: reply },
    });
  }

  /** Remove the owner's reply (§7). */
  deleteReviewReply(reviewId: string) {
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { ownerReply: null },
    });
  }

  // ── Notifications ──────────────────────────────────────────
  listNotifications(accountId: string) {
    return this.prisma.notification.findMany({
      where: { accountId },
      orderBy: { at: 'desc' },
      take: 100,
    });
  }
}
