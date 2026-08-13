import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../common/uuid';

/**
 * Waitlist. When a cabin frees, ALL waitlisted customers are notified at once;
 * the notification link routes through a normal hold attempt so first-to-hold
 * wins (plan §2). No queue positions are stored.
 */
@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Join the waitlist for a departure. Idempotent per (departure, customer): a
   * repeat join updates the party size instead of stacking duplicate rows, so a
   * customer tapping "join" twice doesn't get notified twice.
   */
  async join(departureId: string, customerId: string, partySize: number) {
    const existing = await this.prisma.bookingWaitlist.findFirst({
      where: { departureId, customerId },
      select: { id: true },
    });
    if (existing) {
      return this.prisma.bookingWaitlist.update({
        where: { id: existing.id },
        data: { partySize },
      });
    }
    return this.prisma.bookingWaitlist.create({
      data: { id: newId(), departureId, customerId, partySize },
    });
  }

  /** Leave a waitlist entry (must be the caller's own). */
  async leave(id: string, customerId: string) {
    const res = await this.prisma.bookingWaitlist.deleteMany({
      where: { id, customerId },
    });
    if (res.count === 0) throw new NotFoundException('Waitlist entry not found');
    return { ok: true };
  }

  /** The caller's own waitlist entries, with the departure they're waiting on. */
  listForCustomer(customerId: string) {
    return this.prisma.bookingWaitlist.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        departure: {
          select: {
            id: true,
            startDate: true,
            availableCount: true,
            package: {
              select: {
                durationLabel: true,
                houseboat: { select: { name: true, slug: true } },
                route: { select: { name: true, region: true } },
              },
            },
          },
        },
      },
    });
  }

  /** Accounts to notify when a cabin frees on this departure. */
  listForDeparture(departureId: string) {
    return this.prisma.bookingWaitlist.findMany({
      where: { departureId },
      include: { customer: { select: { id: true, phone: true, email: true } } },
    });
  }
}
