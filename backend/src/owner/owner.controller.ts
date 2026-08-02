import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { OwnerDashboardService } from './owner-dashboard.service';
import { OwnerReportsService } from './owner-reports.service';
import { OwnerGuestsService } from './owner-guests.service';
import { AuditService } from '../audit/audit.service';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  AuditQueryDto,
  GuestsQueryDto,
  MonthQueryDto,
  MonthlyReportQueryDto,
} from './dto/owner.dto';

/**
 * Owner console read surface: the aggregated views that don't belong to any
 * single domain module — dashboard, calendar, profit reports, guest directory
 * and the boat's audit trail.
 *
 * These are the first routes to use the `reports` permission module, which the
 * Owner role has granted since it was introduced.
 */
@Controller('houseboats/:houseboatId')
export class OwnerController {
  constructor(
    private readonly dashboard: OwnerDashboardService,
    private readonly reports: OwnerReportsService,
    private readonly guests: OwnerGuestsService,
    private readonly audit: AuditService,
  ) {}

  /** Home screen: KPIs, today's departures, week summary, sidebar badges. */
  @Get('dashboard')
  @RequirePermission({ module: 'reports', action: 'view' })
  getDashboard(@Param('houseboatId') houseboatId: string) {
    return this.dashboard.dashboard(houseboatId);
  }

  @Get('calendar')
  @RequirePermission({ module: 'trips', action: 'view' })
  getCalendar(
    @Param('houseboatId') houseboatId: string,
    @Query() query: MonthQueryDto,
  ) {
    return this.dashboard.calendar(houseboatId, query.month);
  }

  @Get('reports/trips')
  @RequirePermission({ module: 'reports', action: 'view' })
  tripReport(
    @Param('houseboatId') houseboatId: string,
    @Query() query: MonthQueryDto,
  ) {
    return this.reports.tripReport(houseboatId, query.month);
  }

  @Get('reports/monthly')
  @RequirePermission({ module: 'reports', action: 'view' })
  monthlyReport(
    @Param('houseboatId') houseboatId: string,
    @Query() query: MonthlyReportQueryDto,
  ) {
    return this.reports.monthlyReport(houseboatId, query.months);
  }

  /** Earnings statement — money view, since it reports on settlement. */
  @Get('earnings')
  @RequirePermission({ module: 'money', action: 'view' })
  earnings(
    @Param('houseboatId') houseboatId: string,
    @Query() query: MonthQueryDto,
  ) {
    return this.reports.earnings(houseboatId, query.month);
  }

  @Get('guests')
  @RequirePermission({ module: 'bookings', action: 'view' })
  listGuests(
    @Param('houseboatId') houseboatId: string,
    @Query() query: GuestsQueryDto,
  ) {
    return this.guests.list(houseboatId, query);
  }

  /** Download the guest directory as CSV (§8). */
  @Get('guests/export')
  @RequirePermission({ module: 'bookings', action: 'view' })
  async exportGuests(
    @Param('houseboatId') houseboatId: string,
    @Query() query: GuestsQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.guests.exportCsv(houseboatId, query.q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="guests.csv"');
    res.send(csv);
  }

  /** Audit trail. Gated on settings:view — it exposes role and money actions. */
  @Get('audit')
  @RequirePermission({ module: 'settings', action: 'view' })
  listAudit(
    @Param('houseboatId') houseboatId: string,
    @Query() query: AuditQueryDto,
  ) {
    return this.audit.list(houseboatId, query);
  }

  @Get('audit/actions')
  @RequirePermission({ module: 'settings', action: 'view' })
  auditActions(@Param('houseboatId') houseboatId: string) {
    return this.audit.actions(houseboatId);
  }
}
