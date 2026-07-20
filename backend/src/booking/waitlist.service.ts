import { Injectable } from '@nestjs/common';
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

  join(departureId: string, customerId: string, partySize: number) {
    return this.prisma.bookingWaitlist.create({
      data: { id: newId(), departureId, customerId, partySize },
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
