import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, PlatformOnly } from '../../auth/decorators';
import { AuthUser } from '../../auth/auth.types';
import { RoutesService } from '../../assets/routes.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { PlatformPermission } from '../rbac/platform-permission.decorator';
import { PlatformOpsService } from '../services/platform-ops.service';
import {
  ListAccountsQueryDto,
  ListAuditQueryDto,
  ListBookingsQueryDto,
  ListMembershipsQueryDto,
  ListNotificationsQueryDto,
  ListReschedulesQueryDto,
  ListReviewsQueryDto,
  ListRolesQueryDto,
  ListWaitlistQueryDto,
  SetRouteActiveDto,
} from '../dto/platform.dto';

/**
 * Cross-boat operational surface. See PlatformFinanceController for why
 * @PlatformOnly() is class-level rather than per-route.
 */
@PlatformOnly()
@PlatformPermission('ops', 'view')
@Controller('platform/ops')
export class PlatformOpsController {
  constructor(
    private readonly ops: PlatformOpsService,
    private readonly routes: RoutesService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Live counts for the dashboard KPIs and sidebar badges. */
  @Get('overview')
  overview() {
    return this.ops.overview();
  }

  /** Non-secret config status — presence booleans, never secret values. */
  @PlatformPermission('settings', 'view')
  @Get('settings')
  settingsStatus() {
    return this.ops.settingsStatus();
  }

  @Get('waitlist')
  listWaitlist(@Query() query: ListWaitlistQueryDto) {
    return this.ops.listWaitlist(query);
  }

  @Get('bookings')
  listBookings(@Query() query: ListBookingsQueryDto) {
    return this.ops.listBookings(query);
  }

  @Get('reviews')
  listReviews(@Query() query: ListReviewsQueryDto) {
    return this.ops.listReviews(query);
  }

  @PlatformPermission('accounts', 'view')
  @Get('accounts')
  listAccounts(@Query() query: ListAccountsQueryDto) {
    return this.ops.listAccounts(query);
  }

  @PlatformPermission('accounts', 'view')
  @Get('memberships')
  listMemberships(@Query() query: ListMembershipsQueryDto) {
    return this.ops.listMemberships(query);
  }

  @Get('reschedules')
  listReschedules(@Query() query: ListReschedulesQueryDto) {
    return this.ops.listReschedules(query);
  }

  @Get('notifications')
  listNotifications(@Query() query: ListNotificationsQueryDto) {
    return this.ops.listNotifications(query);
  }

  /** Re-dispatch a recorded notification from its stored payload (422 for legacy rows). */
  @PlatformPermission('ops', 'edit')
  @Post('notifications/:notificationId/resend')
  resendNotification(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notifications.resend(notificationId, user.id);
  }

  @Get('audit')
  listAudit(@Query() query: ListAuditQueryDto) {
    return this.ops.listAudit(query);
  }

  @PlatformPermission('roles', 'view')
  @Get('roles')
  listRoles(@Query() query: ListRolesQueryDto) {
    return this.ops.listRoles(query);
  }

  /** Departures at/past their date still awaiting status advance or finalize. */
  @Get('departures/due')
  listDueDepartures() {
    return this.ops.listDueDepartures();
  }

  /**
   * All routes including retired ones, with boat counts.
   *
   * Distinct from the public GET /api/routes, which is active-only.
   */
  @Get('routes')
  listRoutes() {
    return this.ops.listRoutes();
  }

  /**
   * Activate/deactivate a platform-curated route.
   *
   * RoutesService.setActive already existed but had no HTTP route, so routes
   * could be created and never retired.
   */
  @PlatformPermission('ops', 'edit')
  @Patch('routes/:routeId/active')
  setRouteActive(
    @Param('routeId') routeId: string,
    @Body() dto: SetRouteActiveDto,
  ) {
    return this.routes.setActive(routeId, dto.active);
  }
}
