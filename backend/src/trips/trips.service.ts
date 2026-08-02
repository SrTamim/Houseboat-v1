import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { newId } from '../common/uuid';
import { CreatePackageDto, CreateDepartureDto } from './dto/trips.dto';

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

  listPackages(houseboatId: string) {
    return this.prisma.tripPackage.findMany({
      where: { houseboatId },
      include: { route: true, departures: true },
    });
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

  async cancelDeparture(departureId: string, actorId: string) {
    const dep = await this.prisma.tripDeparture.update({
      where: { id: departureId },
      data: { status: 'cancelled' },
    });
    await this.audit.log({
      actorAccountId: actorId,
      action: 'departure_cancel',
      entityType: 'trip_departure',
      entityId: departureId,
    });
    return dep;
  }
}
