import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { newId } from '../common/uuid';
import {
  CreatePackageDto,
  CreateDepartureDto,
  UpdatePackageDto,
  UpdateDepartureDto,
} from './dto/trips.dto';

/**
 * Trip packages + scheduled departures. Plan §7:
 *  - Only dates in houseboat.operating_dates[] are bookable.
 *  - Multi-day trips: end_date = start_date + duration_days - 1; must be booked
 *    on the start date.
 *  - available_count is DENORMALIZED and initialised to the boat's total cabin
 *    count; holds/bookings/releases mutate it transactionally (see BookingModule).
 */
@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  createPackage(houseboatId: string, dto: CreatePackageDto) {
    return this.prisma.tripPackage.create({
      data: {
        id: newId(),
        houseboatId,
        routeId: dto.routeId,
        durationDays: dto.durationDays,
        durationLabel: dto.durationLabel,
        departureGhat: dto.departureGhat,
        returnGhat: dto.returnGhat,
        meals: dto.meals,
        included: dto.included,
        excluded: dto.excluded,
        cancellationPolicyId: dto.cancellationPolicyId,
      },
    });
  }

  async listPackages(houseboatId: string, activeRouteOnly = false) {
    const where: Prisma.TripPackageWhereInput = { houseboatId };
    if (activeRouteOnly) {
      const activeLink = await this.prisma.houseboatRoute.findFirst({
        where: { houseboatId },
        select: { routeId: true },
      });
      // No linked route → no active-route packages.
      where.routeId = activeLink?.routeId ?? '__none__';
    }
    return this.prisma.tripPackage.findMany({
      where,
      include: { route: true, departures: true },
    });
  }

  private async ownedPackage(houseboatId: string, packageId: string) {
    const pkg = await this.prisma.tripPackage.findUnique({
      where: { id: packageId },
    });
    if (!pkg || pkg.houseboatId !== houseboatId) {
      throw new NotFoundException('Package not found for this boat');
    }
    return pkg;
  }

  async updatePackage(
    houseboatId: string,
    packageId: string,
    dto: UpdatePackageDto,
    actorId: string,
  ) {
    await this.ownedPackage(houseboatId, packageId);
    const updated = await this.prisma.tripPackage.update({
      where: { id: packageId },
      data: {
        routeId: dto.routeId,
        durationDays: dto.durationDays,
        durationLabel: dto.durationLabel,
        departureGhat: dto.departureGhat,
        returnGhat: dto.returnGhat,
        meals: dto.meals,
        included: dto.included,
        excluded: dto.excluded,
        cancellationPolicyId: dto.cancellationPolicyId,
      },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'package_update',
      entityType: 'trip_package',
      entityId: packageId,
    });
    return updated;
  }

  async deletePackage(houseboatId: string, packageId: string, actorId: string) {
    await this.ownedPackage(houseboatId, packageId);
    // Block if the package is in use — deleting one with departures/schedule would
    // cascade into bookings. Owner must remove those first.
    const [departures, schedules] = await Promise.all([
      this.prisma.tripDeparture.count({ where: { packageId } }),
      this.prisma.boatSchedule.count({ where: { packageId } }),
    ]);
    if (departures > 0 || schedules > 0) {
      throw new BadRequestException(
        'This package has departures or a schedule and cannot be deleted. Remove those first.',
      );
    }
    const deleted = await this.prisma.tripPackage.delete({
      where: { id: packageId },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'package_delete',
      entityType: 'trip_package',
      entityId: packageId,
    });
    return deleted;
  }

  timeToDate(hhmm?: string): Date | undefined {
    if (!hhmm) return undefined;
    // Store time-of-day on a fixed epoch date; Prisma @db.Time reads the time part.
    return new Date(`1970-01-01T${hhmm}:00Z`);
  }

  totalCabinCount(houseboatId: string): Promise<number> {
    return this.prisma.houseboatCabin.count({
      where: { deck: { houseboatId } },
    });
  }

  /**
   * Create ONE departure inside an existing transaction — shared by the manual
   * path and the weekly-schedule generator (§1). The caller is responsible for
   * validating that startDate is an operating date and the package belongs to
   * the boat. Initialises availableCount and auto-assigns default crew.
   */
  async createDepartureCore(
    tx: Prisma.TransactionClient,
    params: {
      houseboatId: string;
      packageId: string;
      durationDays: number;
      startDate: Date;
      departureTime?: Date;
      arrivalTime?: Date;
      pricingProfileId?: string | null;
      scheduleSlotId?: string | null;
      availableCount: number;
      defaultCrew: string[];
    },
  ) {
    const endDate = new Date(params.startDate);
    endDate.setUTCDate(endDate.getUTCDate() + params.durationDays - 1);

    const departure = await tx.tripDeparture.create({
      data: {
        id: newId(),
        packageId: params.packageId,
        startDate: params.startDate,
        endDate,
        departureTime: params.departureTime,
        arrivalTime: params.arrivalTime,
        pricingProfileId: params.pricingProfileId ?? undefined,
        scheduleSlotId: params.scheduleSlotId ?? undefined,
        availableCount: params.availableCount,
        status: 'scheduled',
      },
    });

    // Auto-assign crew from the boat's default_crew (plan §8). Only staff still
    // on THIS boat are written.
    if (params.defaultCrew.length > 0) {
      const valid = await tx.houseboatStaff.findMany({
        where: { id: { in: params.defaultCrew }, houseboatId: params.houseboatId },
        select: { id: true },
      });
      if (valid.length > 0) {
        await tx.tripCrew.createMany({
          data: valid.map((s) => ({
            id: newId(),
            departureId: departure.id,
            staffId: s.id,
            present: true,
          })),
        });
      }
    }

    return departure;
  }

  async createDeparture(houseboatId: string, dto: CreateDepartureDto) {
    const pkg = await this.prisma.tripPackage.findUnique({
      where: { id: dto.packageId },
    });
    if (!pkg || pkg.houseboatId !== houseboatId) {
      throw new NotFoundException('Package not found for this boat');
    }

    const boat = await this.prisma.houseboat.findUnique({
      where: { id: houseboatId },
      select: { operatingDates: true, defaultCrew: true },
    });
    const startDate = new Date(dto.startDate);
    const startIso = startDate.toISOString().slice(0, 10);
    const operating = (boat?.operatingDates ?? []).map((d) =>
      d.toISOString().slice(0, 10),
    );
    if (!operating.includes(startIso)) {
      throw new BadRequestException(
        `${startIso} is not in this boat's operating dates`,
      );
    }

    const available = await this.totalCabinCount(houseboatId);

    return this.prisma.$transaction((tx) =>
      this.createDepartureCore(tx, {
        houseboatId,
        packageId: dto.packageId,
        durationDays: pkg.durationDays,
        startDate,
        departureTime: this.timeToDate(dto.departureTime),
        arrivalTime: this.timeToDate(dto.arrivalTime),
        pricingProfileId: dto.pricingProfileId,
        availableCount: available,
        defaultCrew: (boat?.defaultCrew ?? []) as string[],
      }),
    );
  }

  listDepartures(houseboatId: string) {
    return this.prisma.tripDeparture.findMany({
      where: { package: { houseboatId } },
      include: { package: { include: { route: true } } },
      orderBy: { startDate: 'asc' },
    });
  }

  private async ownedDeparture(houseboatId: string, departureId: string) {
    const dep = await this.prisma.tripDeparture.findUnique({
      where: { id: departureId },
      include: { package: true },
    });
    if (!dep || dep.package.houseboatId !== houseboatId) {
      throw new NotFoundException('Departure not found for this boat');
    }
    return dep;
  }

  async updateDeparture(
    houseboatId: string,
    departureId: string,
    dto: UpdateDepartureDto,
    actorId: string,
  ) {
    const dep = await this.ownedDeparture(houseboatId, departureId);

    const data: Prisma.TripDepartureUpdateInput = {};

    if (dto.startDate) {
      const startDate = new Date(dto.startDate);
      const startIso = startDate.toISOString().slice(0, 10);
      const currentIso = dep.startDate.toISOString().slice(0, 10);

      // Moving the date of a departure that already has active bookings would
      // silently reschedule confirmed guests to a new day and re-anchor their
      // cancellation window, with no notice or consent. Refuse it (audit B-M4):
      // cancel the departure (which handles refunds + notifications) instead.
      // A no-op "change" to the same date is allowed (e.g. editing only times).
      if (startIso !== currentIso) {
        const activeBookings = await this.prisma.booking.count({
          where: { departureId, status: { not: 'cancelled' } },
        });
        if (activeBookings > 0) {
          throw new BadRequestException(
            'This departure has bookings — its date cannot be changed. Cancel the departure instead.',
          );
        }
      }

      const boat = await this.prisma.houseboat.findUnique({
        where: { id: houseboatId },
        select: { operatingDates: true },
      });
      const operating = (boat?.operatingDates ?? []).map((d) =>
        d.toISOString().slice(0, 10),
      );
      if (!operating.includes(startIso)) {
        throw new BadRequestException(
          `${startIso} is not in this boat's operating dates`,
        );
      }
      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + dep.package.durationDays - 1);
      data.startDate = startDate;
      data.endDate = endDate;
    }

    if (dto.departureTime !== undefined) {
      data.departureTime = this.timeToDate(dto.departureTime) ?? null;
    }
    if (dto.arrivalTime !== undefined) {
      data.arrivalTime = this.timeToDate(dto.arrivalTime) ?? null;
    }
    if (dto.pricingProfileId !== undefined) {
      data.pricingProfile = dto.pricingProfileId
        ? { connect: { id: dto.pricingProfileId } }
        : { disconnect: true };
    }

    const updated = await this.prisma.tripDeparture.update({
      where: { id: departureId },
      data,
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'departure_update',
      entityType: 'trip_departure',
      entityId: departureId,
    });
    return updated;
  }

  async cancelDeparture(
    houseboatId: string,
    departureId: string,
    actorId: string,
    reason: string,
  ) {
    await this.ownedDeparture(houseboatId, departureId);

    // Operator + route names for the cancellation SMS — loaded once.
    const meta = await this.prisma.tripDeparture.findUnique({
      where: { id: departureId },
      select: {
        package: {
          select: {
            houseboat: { select: { name: true } },
            route: { select: { name: true } },
          },
        },
      },
    });
    const operatorName = meta?.package.houseboat.name ?? '';
    const routeName = meta?.package.route?.name ?? '';

    // Affected customers to notify — active (non-cancelled) bookings on this trip.
    const bookings = await this.prisma.booking.findMany({
      where: { departureId, status: { not: 'cancelled' } },
      select: {
        id: true,
        customer: { select: { id: true, phone: true, email: true } },
      },
    });

    const dep = await this.prisma.tripDeparture.update({
      where: { id: departureId },
      data: { status: 'cancelled', cancelReason: reason, cancelledAt: new Date() },
    });

    // Best-effort — notify() never throws back into this flow.
    for (const b of bookings) {
      await this.notifications.notify({
        accountId: b.customer.id,
        event: 'departure_cancelled',
        to: { phone: b.customer.phone, email: b.customer.email ?? undefined },
        subject: 'Your trip has been cancelled',
        message:
          `[book koro]\n\n` +
          `Your booking cancelled by the boat operator.\n\n` +
          `Operator: ${operatorName}\n` +
          `Booking ID: ${b.id.slice(0, 8)}\n` +
          `Route: ${routeName}\n\n` +
          `Request for refund within 6 days.\n` +
          `login to bookkoro.xyz`,
      });
    }

    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'departure_cancel',
      entityType: 'trip_departure',
      entityId: departureId,
      after: { reason, notified: bookings.length },
    });
    return dep;
  }

  /** Bring a cancelled departure back to scheduled (owner undo). */
  async reviveDeparture(
    houseboatId: string,
    departureId: string,
    actorId: string,
  ) {
    const existing = await this.ownedDeparture(houseboatId, departureId);
    if (existing.status !== 'cancelled') {
      throw new BadRequestException('Only a cancelled departure can be revived');
    }
    const dep = await this.prisma.tripDeparture.update({
      where: { id: departureId },
      data: { status: 'scheduled', cancelReason: null, cancelledAt: null },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'departure_revive',
      entityType: 'trip_departure',
      entityId: departureId,
    });
    return dep;
  }
}
