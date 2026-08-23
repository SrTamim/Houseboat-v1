import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { HrService } from './hr.service';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import {
  AdjustPayrollDto,
  AttendanceQueryDto,
  CreateStaffDto,
  LeaveDto,
  PayrollDto,
  CrewPresenceDto,
  UpdateStaffDto,
} from './dto/hr.dto';

@Controller()
export class HrController {
  constructor(private readonly hr: HrService) {}

  // Staff roster read — the crew page owns it, but the payroll and attendance
  // pages also list staff to pick from, so any of those roles may read it.
  @Get('houseboats/:houseboatId/staff')
  @RequirePermission({
    module: 'crew',
    action: 'view',
    anyOf: ['payroll', 'attendance'],
  })
  listStaff(@Param('houseboatId') houseboatId: string) {
    return this.hr.listStaff(houseboatId);
  }

  @Post('houseboats/:houseboatId/staff')
  @RequirePermission({ module: 'crew', action: 'edit' })
  addStaff(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreateStaffDto,
  ) {
    return this.hr.addStaff(houseboatId, dto);
  }

  @Patch('houseboats/:houseboatId/staff/:staffId')
  @RequirePermission({ module: 'crew', action: 'edit' })
  updateStaff(
    @Param('houseboatId') houseboatId: string,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.hr.updateStaff(houseboatId, staffId, dto);
  }

  @Delete('houseboats/:houseboatId/staff/:staffId')
  @RequirePermission({ module: 'crew', action: 'edit' })
  removeStaff(
    @Param('houseboatId') houseboatId: string,
    @Param('staffId') staffId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hr.removeStaff(houseboatId, staffId, user.id);
  }

  @Post('houseboats/:houseboatId/staff/:staffId/leave')
  @RequirePermission({ module: 'crew', action: 'edit' })
  setLeave(@Param('staffId') staffId: string, @Body() dto: LeaveDto) {
    return this.hr.setLeave(staffId, dto);
  }

  @Post('houseboats/:houseboatId/staff/:staffId/payroll')
  @RequirePermission({ module: 'payroll', action: 'edit' })
  runPayroll(
    @Param('houseboatId') houseboatId: string,
    @Param('staffId') staffId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: PayrollDto,
  ) {
    return this.hr.runPayroll(houseboatId, staffId, dto, user.id);
  }

  @Post('houseboats/:houseboatId/payroll/:payrollId/paid')
  @RequirePermission({ module: 'payroll', action: 'edit' })
  markPaid(
    @Param('houseboatId') houseboatId: string,
    @Param('payrollId') payrollId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.hr.markPayrollPaid(houseboatId, payrollId, user.id);
  }

  @Patch('houseboats/:houseboatId/payroll/:payrollId')
  @RequirePermission({ module: 'payroll', action: 'edit' })
  adjustPayroll(
    @Param('houseboatId') houseboatId: string,
    @Param('payrollId') payrollId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AdjustPayrollDto,
  ) {
    return this.hr.adjustPayroll(houseboatId, payrollId, dto, user.id);
  }

  @Get('houseboats/:houseboatId/staff/:staffId/payroll')
  @RequirePermission({ module: 'payroll', action: 'view' })
  listPayroll(
    @Param('houseboatId') houseboatId: string,
    @Param('staffId') staffId: string,
  ) {
    return this.hr.listPayroll(houseboatId, staffId);
  }

  // ── Attendance report (monthly) ────────────────────────────
  @Get('houseboats/:houseboatId/attendance')
  @RequirePermission({ module: 'attendance', action: 'view' })
  attendance(
    @Param('houseboatId') houseboatId: string,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.hr.attendanceReport(houseboatId, query.period);
  }

  // ── Crew presence (per departure) ──────────────────────────
  @Get('houseboats/:houseboatId/departures/:departureId/crew')
  @RequirePermission({ module: 'departure', action: 'view' })
  listCrew(@Param('departureId') departureId: string) {
    return this.hr.listCrew(departureId);
  }

  @Post('houseboats/:houseboatId/departures/:departureId/crew')
  @RequirePermission({ module: 'departure', action: 'edit' })
  setCrew(
    @Param('departureId') departureId: string,
    @Body() dto: CrewPresenceDto,
  ) {
    return this.hr.setCrewPresence(departureId, dto.staffId, dto.present ?? true);
  }
}
