import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { newId } from '../common/uuid';
import { money, add, sub } from '../common/money';
import { normalizePhone } from '../auth/auth.types';
import {
  AdjustPayrollDto,
  CreateStaffDto,
  LeaveDto,
  PayrollDto,
  UpdateStaffDto,
} from './dto/hr.dto';

type LeaveWindow = {
  state: string;
  fromDate: Date | null;
  toDate: Date | null;
};

/**
 * Effective availability today. `on_leave` only holds while the latest leave's
 * date window covers today; an open-ended leave (no toDate) stays on_leave
 * until explicitly cleared. A window that has fully passed reads `available`
 * regardless of the stored column.
 */
function effectiveStatus(stored: string, leave?: LeaveWindow): string {
  if (stored !== 'on_leave') return stored;
  if (!leave || leave.state !== 'on_leave') return 'available';
  if (!leave.toDate) return 'on_leave'; // open-ended leave
  const endOfDay = new Date(leave.toDate);
  endOfDay.setHours(23, 59, 59, 999);
  return Date.now() > endOfDay.getTime() ? 'available' : 'on_leave';
}

/**
 * UTC month bounds for a "YYYY-MM" period. `monthEnd` is the last instant of
 * the month (for clipping leave ranges). Defaults to the current month when the
 * period is omitted. One rule, used by both the attendance report and payroll,
 * so "trips this month" means the same thing in both places.
 */
function monthBounds(period?: string): {
  resolved: string;
  monthStart: Date;
  nextMonthStart: Date;
  monthEnd: Date;
} {
  const now = new Date();
  const resolved =
    period ??
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const [y, m] = resolved.split('-').map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const nextMonthStart = new Date(Date.UTC(y, m, 1));
  const monthEnd = new Date(nextMonthStart.getTime() - 1);
  return { resolved, monthStart, nextMonthStart, monthEnd };
}

/**
 * HR — staff, crew attendance, payroll, leave (plan §8). Attendance is not a
 * separate screen: it's a trip_crew row existing with present=true. Payroll:
 *   salaried → total = monthly_salary
 *   per-trip → base = per_trip_rate × trips_worked
 *   total = base + bonus − deduction
 */
@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async addStaff(houseboatId: string, dto: CreateStaffDto) {
    const phone = normalizePhone(dto.phone);
    const account = await this.prisma.account.findUnique({ where: { phone } });
    if (!account) {
      throw new NotFoundException('No account with that phone — register first');
    }
    // A role must belong to THIS boat (audit #16/F15) — mirrors membership.service.
    // addMember. Without this a caller could attach another boat's role row to a
    // staff record. (Display/HR metadata, not the RBAC source, but keep it tight.)
    if (dto.roleId) await this.assertRoleOnBoat(dto.roleId, houseboatId);
    return this.prisma.houseboatStaff.create({
      data: {
        id: newId(),
        accountId: account.id,
        houseboatId,
        roleId: dto.roleId,
        designation: dto.designation,
        nid: dto.nid,
        emergencyContact: dto.emergencyContact,
        address: dto.address,
        perTripRate: dto.perTripRate,
        monthlySalary: dto.monthlySalary,
      },
    });
  }

  async listStaff(houseboatId: string) {
    const staff = await this.prisma.houseboatStaff.findMany({
      where: { houseboatId },
      include: {
        account: { select: { name: true, phone: true } },
        // Latest leave gives us the active date range to age-out.
        leaves: {
          orderBy: { fromDate: 'desc' },
          take: 1,
          select: { state: true, fromDate: true, toDate: true },
        },
      },
    });

    // A leave range expires: once toDate has passed, the person is available
    // again even though nobody re-saved them. Reconcile the stored column so
    // reports stay correct — self-healing, no cron.
    const fixes: string[] = [];
    const rows = staff.map((s) => {
      const effective = effectiveStatus(s.status, s.leaves[0]);
      if (effective !== s.status) fixes.push(s.id);
      const { leaves, ...rest } = s;
      return { ...rest, status: effective };
    });
    if (fixes.length) {
      await this.prisma.houseboatStaff.updateMany({
        where: { id: { in: fixes } },
        data: { status: 'available' },
      });
    }
    return rows;
  }

  /** A staffId must belong to this houseboat before we mutate it. */
  private async assertStaffOwned(houseboatId: string, staffId: string) {
    const staff = await this.prisma.houseboatStaff.findFirst({
      where: { id: staffId, houseboatId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Crew member not found on this houseboat.');
  }

  /** A roleId assigned to staff must belong to this houseboat (audit #16/F15). */
  private async assertRoleOnBoat(roleId: string, houseboatId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, houseboatId },
      select: { id: true },
    });
    if (!role) throw new NotFoundException('Role not found on this houseboat.');
  }

  /**
   * A payrollId must belong to this houseboat (via its staff) before we mutate
   * it. The controller only authorizes the :houseboatId in the URL — without
   * this, a payrollId from another boat would pass the guard (IDOR).
   */
  private async assertPayrollOwned(houseboatId: string, payrollId: string) {
    const payroll = await this.prisma.staffPayroll.findFirst({
      where: { id: payrollId, staff: { houseboatId } },
      select: { id: true },
    });
    if (!payroll) throw new NotFoundException('Payroll record not found on this houseboat.');
  }

  async updateStaff(houseboatId: string, staffId: string, dto: UpdateStaffDto) {
    await this.assertStaffOwned(houseboatId, staffId);
    return this.prisma.houseboatStaff.update({
      where: { id: staffId },
      data: {
        designation: dto.designation,
        nid: dto.nid,
        emergencyContact: dto.emergencyContact,
        address: dto.address,
        status: dto.status,
        // Pay-type is exclusive: a `null` clears the other side when switching.
        perTripRate: dto.perTripRate,
        monthlySalary: dto.monthlySalary,
      },
    });
  }

  async removeStaff(houseboatId: string, staffId: string, actorId: string) {
    await this.assertStaffOwned(houseboatId, staffId);
    const [payroll, crew] = await Promise.all([
      this.prisma.staffPayroll.count({ where: { staffId } }),
      this.prisma.tripCrew.count({ where: { staffId } }),
    ]);
    if (payroll > 0) {
      throw new ConflictException(
        'This crew member has payroll history and cannot be deleted. Set them to on-leave instead.',
      );
    }
    if (crew > 0) {
      throw new ConflictException(
        'This crew member has trip attendance records and cannot be deleted. Set them to on-leave instead.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.staffLeave.deleteMany({ where: { staffId } }),
      this.prisma.houseboatStaff.delete({ where: { id: staffId } }),
    ]);
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'staff_delete',
      entityType: 'houseboat_staff',
      entityId: staffId,
    });
    return { ok: true };
  }

  /** A departureId must belong to this houseboat before we read/mutate its crew. */
  private async assertDepartureOwned(houseboatId: string, departureId: string) {
    const dep = await this.prisma.tripDeparture.findFirst({
      where: { id: departureId, package: { houseboatId } },
      select: { id: true },
    });
    if (!dep) {
      throw new NotFoundException('Departure not found on this houseboat.');
    }
  }

  // ── Leave ──────────────────────────────────────────────────
  /** Records a leave row and keeps the denormalized staff.status in sync. */
  async setLeave(houseboatId: string, staffId: string, dto: LeaveDto) {
    // IDOR guard: the controller only authorizes the URL :houseboatId, so verify
    // the staffId actually belongs to it before writing (mirrors updateStaff).
    await this.assertStaffOwned(houseboatId, staffId);
    const fromDate = dto.fromDate ? new Date(dto.fromDate) : null;
    const toDate = dto.toDate ? new Date(dto.toDate) : null;
    // Don't mark on_leave for a window that has already passed — it would just
    // age back to available on the next read anyway.
    const status = effectiveStatus(
      dto.state === 'on_leave' ? 'on_leave' : 'available',
      { state: dto.state, fromDate, toDate },
    );
    return this.prisma.$transaction(async (tx) => {
      const leave = await tx.staffLeave.create({
        data: {
          id: newId(),
          staffId,
          state: dto.state,
          fromDate: fromDate ?? undefined,
          toDate: toDate ?? undefined,
          note: dto.note,
        },
      });
      await tx.houseboatStaff.update({
        where: { id: staffId },
        data: { status },
      });
      return leave;
    });
  }

  // ── Crew / attendance ──────────────────────────────────────
  /** Set/override a crew member's presence for a departure (upsert the row). */
  async setCrewPresence(
    houseboatId: string,
    departureId: string,
    staffId: string,
    present: boolean,
  ) {
    // IDOR guards: the controller authorizes only the URL :houseboatId, so both
    // the departure AND the staff must belong to it before we write.
    await this.assertDepartureOwned(houseboatId, departureId);
    await this.assertStaffOwned(houseboatId, staffId);
    return this.prisma.tripCrew.upsert({
      where: { departureId_staffId: { departureId, staffId } },
      update: { present },
      create: { id: newId(), departureId, staffId, present },
    });
  }

  async listCrew(houseboatId: string, departureId: string) {
    // IDOR guard: the departure must belong to the authorized boat.
    await this.assertDepartureOwned(houseboatId, departureId);
    return this.prisma.tripCrew.findMany({
      where: { departureId },
      include: {
        staff: {
          include: {
            account: { select: { name: true } },
            role: { select: { name: true } },
          },
        },
      },
    });
  }

  // ── Attendance report (monthly, HR-style) ─────────────────
  /**
   * Per-crew monthly report: trips worked (present crew rows on departures that
   * start in the month) and days on leave (StaffLeave ranges overlapping the
   * month, clipped to its bounds). `period` is "YYYY-MM"; defaults to the
   * current month. Trips-worked reuses the attendance rule from runPayroll:
   * a present=true trip_crew row is one trip worked.
   */
  async attendanceReport(houseboatId: string, period?: string) {
    // Last instant of the month is used for clipping open-ended leave ranges.
    const { resolved, monthStart, nextMonthStart, monthEnd } = monthBounds(period);

    const staff = await this.prisma.houseboatStaff.findMany({
      where: { houseboatId },
      include: {
        account: { select: { name: true, phone: true } },
        role: { select: { name: true } },
      },
    });

    // Trips worked: present crew rows on departures starting this month.
    const presentRows = await this.prisma.tripCrew.groupBy({
      by: ['staffId'],
      where: {
        present: true,
        staff: { houseboatId },
        departure: { startDate: { gte: monthStart, lt: nextMonthStart } },
      },
      _count: { _all: true },
    });
    const tripsByStaff = new Map(
      presentRows.map((r) => [r.staffId, r._count._all]),
    );

    // Leave ranges overlapping the month. Open-ended (no toDate) runs to month end.
    const leaves = await this.prisma.staffLeave.findMany({
      where: {
        staff: { houseboatId },
        state: { in: ['on_leave', 'other_duty'] },
        fromDate: { lt: nextMonthStart },
        OR: [{ toDate: null }, { toDate: { gte: monthStart } }],
      },
      select: { staffId: true, fromDate: true, toDate: true },
    });
    const dayMs = 24 * 60 * 60 * 1000;
    const leaveDaysByStaff = new Map<string, number>();
    for (const l of leaves) {
      const from = l.fromDate && l.fromDate > monthStart ? l.fromDate : monthStart;
      const to = l.toDate && l.toDate < monthEnd ? l.toDate : monthEnd;
      const days = Math.floor((to.getTime() - from.getTime()) / dayMs) + 1;
      if (days > 0) {
        leaveDaysByStaff.set(
          l.staffId,
          (leaveDaysByStaff.get(l.staffId) ?? 0) + days,
        );
      }
    }

    return {
      period: resolved,
      crew: staff.map((s) => ({
        staffId: s.id,
        name: s.account?.name ?? null,
        phone: s.account?.phone ?? null,
        role: s.role?.name ?? null,
        tripsWorked: tripsByStaff.get(s.id) ?? 0,
        leaveDays: leaveDaysByStaff.get(s.id) ?? 0,
      })),
    };
  }

  // ── Payroll ────────────────────────────────────────────────
  async runPayroll(
    houseboatId: string,
    staffId: string,
    dto: PayrollDto,
    actorId: string,
  ) {
    await this.assertStaffOwned(houseboatId, staffId);
    const staff = await this.prisma.houseboatStaff.findUnique({
      where: { id: staffId },
    });
    if (!staff) throw new NotFoundException('Staff not found');

    const bonus = money(dto.bonus ?? 0);
    const deduction = money(dto.deduction ?? 0);

    let base = money(0);
    let tripsWorked: number | undefined;

    if (staff.monthlySalary) {
      base = money(staff.monthlySalary);
    } else if (staff.perTripRate) {
      // Count present crew rows for this staff in the payroll period — same rule
      // as the attendance report, so per-trip pay matches trips-worked there.
      const { monthStart, nextMonthStart } = monthBounds(dto.period);
      tripsWorked = await this.prisma.tripCrew.count({
        where: {
          staffId,
          present: true,
          departure: { startDate: { gte: monthStart, lt: nextMonthStart } },
        },
      });
      base = money(staff.perTripRate).mul(tripsWorked);
    } else {
      throw new BadRequestException(
        'Staff has neither monthly_salary nor per_trip_rate set',
      );
    }

    const total = sub(add(base, bonus), deduction);

    const payroll = await this.prisma.staffPayroll.create({
      data: {
        id: newId(),
        staffId,
        period: dto.period,
        tripsWorked,
        baseAmount: base,
        bonus,
        deduction,
        totalAmount: total,
        paid: false,
      },
    });
    await this.audit.log({
      houseboatId: staff.houseboatId,
      actorAccountId: actorId,
      action: 'payroll_run',
      entityType: 'staff_payroll',
      entityId: payroll.id,
      after: { total: total.toFixed(2), period: dto.period },
    });
    return payroll;
  }

  async markPayrollPaid(houseboatId: string, payrollId: string, actorId: string) {
    await this.assertPayrollOwned(houseboatId, payrollId);
    const payroll = await this.prisma.staffPayroll.update({
      where: { id: payrollId },
      data: { paid: true, paidAt: new Date(), paidBy: actorId },
    });
    await this.audit.log({
      houseboatId,
      actorAccountId: actorId,
      action: 'payroll_paid',
      entityType: 'staff_payroll',
      entityId: payrollId,
    });
    return payroll;
  }

  /**
   * Adjust an existing payroll after the fact. Only bonus/deduction are
   * editable — the base amount is a computed record of what was owed and stays
   * fixed. `total` is recomputed from the (unchanged) base. Optionally flip the
   * paid flag, so an owner who marked-paid by mistake can revert.
   */
  async adjustPayroll(
    houseboatId: string,
    payrollId: string,
    dto: AdjustPayrollDto,
    actorId: string,
  ) {
    await this.assertPayrollOwned(houseboatId, payrollId);
    const existing = await this.prisma.staffPayroll.findUnique({
      where: { id: payrollId },
      include: { staff: { select: { houseboatId: true } } },
    });
    if (!existing) throw new NotFoundException('Payroll record not found');

    const bonus = dto.bonus !== undefined ? money(dto.bonus) : money(existing.bonus);
    const deduction =
      dto.deduction !== undefined ? money(dto.deduction) : money(existing.deduction);
    const total = sub(add(money(existing.baseAmount), bonus), deduction);

    const data: {
      bonus: typeof bonus;
      deduction: typeof deduction;
      totalAmount: typeof total;
      paid?: boolean;
      paidAt?: Date | null;
      paidBy?: string | null;
    } = { bonus, deduction, totalAmount: total };
    if (dto.paid !== undefined) {
      data.paid = dto.paid;
      data.paidAt = dto.paid ? new Date() : null;
      data.paidBy = dto.paid ? actorId : null;
    }

    const payroll = await this.prisma.staffPayroll.update({
      where: { id: payrollId },
      data,
    });
    await this.audit.log({
      houseboatId: existing.staff.houseboatId,
      actorAccountId: actorId,
      action: 'payroll_adjust',
      entityType: 'staff_payroll',
      entityId: payrollId,
      before: {
        bonus: existing.bonus.toFixed(2),
        deduction: existing.deduction.toFixed(2),
        total: existing.totalAmount.toFixed(2),
        paid: existing.paid,
      },
      after: {
        bonus: bonus.toFixed(2),
        deduction: deduction.toFixed(2),
        total: total.toFixed(2),
        paid: payroll.paid,
      },
    });
    return payroll;
  }

  async listPayroll(houseboatId: string, staffId: string) {
    await this.assertStaffOwned(houseboatId, staffId);
    return this.prisma.staffPayroll.findMany({
      where: { staffId },
      orderBy: { period: 'desc' },
    });
  }
}
