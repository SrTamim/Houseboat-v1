import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { newId } from '../common/uuid';
import { money, add, sub } from '../common/money';
import { normalizePhone } from '../auth/auth.types';
import { CreateStaffDto, LeaveDto, PayrollDto } from './dto/hr.dto';

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
    return this.prisma.houseboatStaff.create({
      data: {
        id: newId(),
        accountId: account.id,
        houseboatId,
        roleId: dto.roleId,
        nid: dto.nid,
        emergencyContact: dto.emergencyContact,
        perTripRate: dto.perTripRate,
        monthlySalary: dto.monthlySalary,
      },
    });
  }

  listStaff(houseboatId: string) {
    return this.prisma.houseboatStaff.findMany({
      where: { houseboatId },
      include: { account: { select: { name: true, phone: true } } },
    });
  }

  // ── Leave ──────────────────────────────────────────────────
  setLeave(staffId: string, dto: LeaveDto) {
    return this.prisma.staffLeave.create({
      data: {
        id: newId(),
        staffId,
        state: dto.state,
        fromDate: dto.fromDate ? new Date(dto.fromDate) : undefined,
        toDate: dto.toDate ? new Date(dto.toDate) : undefined,
        note: dto.note,
      },
    });
  }

  // ── Crew / attendance ──────────────────────────────────────
  /** Set/override a crew member's presence for a departure (upsert the row). */
  async setCrewPresence(
    departureId: string,
    staffId: string,
    present: boolean,
  ) {
    return this.prisma.tripCrew.upsert({
      where: { departureId_staffId: { departureId, staffId } },
      update: { present },
      create: { id: newId(), departureId, staffId, present },
    });
  }

  listCrew(departureId: string) {
    return this.prisma.tripCrew.findMany({
      where: { departureId },
      include: { staff: { include: { account: { select: { name: true } } } } },
    });
  }

  // ── Payroll ────────────────────────────────────────────────
  async runPayroll(staffId: string, dto: PayrollDto, actorId: string) {
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
      // Count present crew rows for this staff (attendance = row + present).
      tripsWorked = await this.prisma.tripCrew.count({
        where: { staffId, present: true },
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

  async markPayrollPaid(payrollId: string, actorId: string) {
    const payroll = await this.prisma.staffPayroll.update({
      where: { id: payrollId },
      data: { paid: true, paidAt: new Date(), paidBy: actorId },
    });
    await this.audit.log({
      actorAccountId: actorId,
      action: 'payroll_paid',
      entityType: 'staff_payroll',
      entityId: payrollId,
    });
    return payroll;
  }

  listPayroll(staffId: string) {
    return this.prisma.staffPayroll.findMany({
      where: { staffId },
      orderBy: { period: 'desc' },
    });
  }
}
