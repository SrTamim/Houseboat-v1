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
  ListReviewsQueryDto,
  ListRolesQueryDto,
  ListWaitlistQueryDto,
  SetReviewHiddenDto,
  SetRouteActiveDto,
  UpdateRouteDto,
} from '../dto/platform.dto';

/**
 * Cross-boat operational surface. See PlatformFinanceController for why
 * @PlatformOnly() is class-level rather than per-route.
 */
@PlatformOnly()
@Controller('platform/ops')
export class PlatformOpsController {
  constructor(
    private readonly ops: PlatformOpsService,
    private readonly routes: RoutesService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Live counts for the dashboard KPIs and sidebar badges. Intentionally
   * ungated: the sidebar polls this on every console page for every staffer, so
   * a per-page grant here would 403 console-wide for a restricted role.
   */
  @Get('overview')
  overview() {
    return this.ops.overview();
  }

  /** Non-secret config status — presence booleans, never secret values. Feeds the System & health page. */
  @PlatformPermission('jobs', 'view')
  @Get('settings')
  settingsStatus() {
    return this.ops.settingsStatus();
  }

  @PlatformPermission('waitlist', 'view')
  @Get('waitlist')
  listWaitlist(@Query() query: ListWaitlistQueryDto) {
    return this.ops.listWaitlist(query);
  }

  @PlatformPermission('bookings', 'view')
  @Get('bookings')
  listBookings(@Query() query: ListBookingsQueryDto) {
    return this.ops.listBookings(query);
  }

  /** Full detail for one booking — the admin "Open" drawer. */
  @PlatformPermission('bookings', 'view')
  @Get('bookings/:bookingId')
  getBooking(@Param('bookingId') bookingId: string) {
    return this.ops.getBooking(bookingId);
  }

  @PlatformPermission('reviews', 'view')
  @Get('reviews')
  listReviews(@Query() query: ListReviewsQueryDto) {
    return this.ops.listReviews(query);
  }

  /** Hide or unhide a review (platform moderation). */
  @PlatformPermission('reviews', 'edit')
  @Patch('reviews/:reviewId/hidden')
  setReviewHidden(
    @Param('reviewId') reviewId: string,
    @Body() dto: SetReviewHiddenDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ops.setReviewHidden(reviewId, dto.hidden, user.id);
  }

  @PlatformPermission('accounts', 'view')
  @Get('accounts')
  listAccounts(@Query() query: ListAccountsQueryDto) {
    return this.ops.listAccounts(query);
  }

  @PlatformPermission('memberships', 'view')
  @Get('memberships')
  listMemberships(@Query() query: ListMembershipsQueryDto) {
    return this.ops.listMemberships(query);
  }

  @PlatformPermission('notifications', 'view')
  @Get('notifications')
  listNotifications(@Query() query: ListNotificationsQueryDto) {
    return this.ops.listNotifications(query);
  }

  /** Re-dispatch a recorded notification from its stored payload (422 for legacy rows). */
  @PlatformPermission('notifications', 'edit')
  @Post('notifications/:notificationId/resend')
  resendNotification(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notifications.resend(notificationId, user.id);
  }

  @PlatformPermission('audit', 'view')
  @Get('audit')
  listAudit(@Query() query: ListAuditQueryDto) {
    return this.ops.listAudit(query);
  }

  @PlatformPermission('roles', 'view')
  @Get('roles')
  listRoles(@Query() query: ListRolesQueryDto) {
    return this.ops.listRoles(query);
  }

  /** Departures at/past their date still awaiting status advance or finalize. Read on the bookings surface. */
  @PlatformPermission('bookings', 'view')
  @Get('departures/due')
  listDueDepartures() {
    return this.ops.listDueDepartures();
  }

  /**
   * All routes including retired ones, with boat counts.
   *
   * Distinct from the public GET /api/routes, which is active-only.
   */
  @PlatformPermission('routes', 'view')
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
  @PlatformPermission('routes', 'edit')
  @Patch('routes/:routeId/active')
  setRouteActive(
    @Param('routeId') routeId: string,
    @Body() dto: SetRouteActiveDto,
  ) {
    return this.routes.setActive(routeId, dto.active);
  }

  /** Edit a route's name/region. Active state stays on the toggle above. */
  @PlatformPermission('routes', 'edit')
  @Patch('routes/:routeId')
  updateRoute(
    @Param('routeId') routeId: string,
    @Body() dto: UpdateRouteDto,
  ) {
    return this.routes.update(routeId, { name: dto.name, region: dto.region });
  }
}
