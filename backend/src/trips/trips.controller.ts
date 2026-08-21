import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { TripsService } from './trips.service';
import { ScheduleGeneratorService } from './schedule-generator.service';
import { PricingService } from '../pricing/pricing.service';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import {
  CancelDepartureDto,
  CreatePackageDto,
  CreateDepartureDto,
  SaveScheduleDto,
  UpdatePackageDto,
  UpdateDepartureDto,
} from './dto/trips.dto';
import {
  CreatePricingProfileDto,
  GroupBandDto,
  UpsertRoutePricingDto,
} from '../pricing/dto/pricing.dto';

@Controller('houseboats/:houseboatId')
export class TripsController {
  constructor(
    private readonly trips: TripsService,
    private readonly schedule: ScheduleGeneratorService,
    private readonly pricing: PricingService,
  ) {}

  // ── Weekly schedule (§1) ───────────────────────────────────
  @Get('schedule')
  @RequirePermission({ module: 'schedule', action: 'view' })
  getSchedule(@Param('houseboatId') houseboatId: string) {
    return this.schedule.getSchedule(houseboatId);
  }

  @Put('schedule')
  @RequirePermission({ module: 'schedule', action: 'edit' })
  saveSchedule(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveScheduleDto,
  ) {
    return this.schedule.saveSchedule(houseboatId, user.id, dto);
  }

  // ── Packages ───────────────────────────────────────────────
  // Package list — read by the packages page and the schedule page's slot editor.
  @Get('packages')
  @RequirePermission({ module: 'packages', action: 'view', anyOf: ['schedule'] })
  listPackages(
    @Param('houseboatId') houseboatId: string,
    @Query('route') route?: string,
  ) {
    return this.trips.listPackages(houseboatId, route === 'active');
  }

  @Post('packages')
  @RequirePermission({ module: 'packages', action: 'edit' })
  createPackage(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreatePackageDto,
  ) {
    return this.trips.createPackage(houseboatId, dto);
  }

  @Patch('packages/:packageId')
  @RequirePermission({ module: 'packages', action: 'edit' })
  updatePackage(
    @Param('houseboatId') houseboatId: string,
    @Param('packageId') packageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePackageDto,
  ) {
    return this.trips.updatePackage(houseboatId, packageId, dto, user.id);
  }

  @Delete('packages/:packageId')
  @RequirePermission({ module: 'packages', action: 'edit' })
  deletePackage(
    @Param('houseboatId') houseboatId: string,
    @Param('packageId') packageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.trips.deletePackage(houseboatId, packageId, user.id);
  }

  // ── Departures ─────────────────────────────────────────────
  // Listed under `departures-list`, not `departures`, to avoid colliding with
  // the public `GET houseboats/:slug/departures` route: both controllers share
  // the `houseboats` base, HouseboatsModule loads first, so a plain
  // `GET departures` here is shadowed by the public handler, which treats the
  // owner's boat UUID as a slug and 404s. Mutations keep the `departures/:id`
  // paths (no public GET-only twin to collide with).
  // Shared read: consumed by the departure, schedule and pos pages. Any of those
  // roles may list departures; management (create/cancel/revive) below stays on
  // schedule:edit.
  @Get('departures-list')
  @RequirePermission({
    module: 'departure',
    action: 'view',
    anyOf: ['schedule', 'pos'],
  })
  listDepartures(@Param('houseboatId') houseboatId: string) {
    return this.trips.listDepartures(houseboatId);
  }

  @Post('departures')
  @RequirePermission({ module: 'schedule', action: 'edit' })
  createDeparture(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreateDepartureDto,
  ) {
    return this.trips.createDeparture(houseboatId, dto);
  }

  @Patch('departures/:departureId')
  @RequirePermission({ module: 'schedule', action: 'edit' })
  updateDeparture(
    @Param('houseboatId') houseboatId: string,
    @Param('departureId') departureId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDepartureDto,
  ) {
    return this.trips.updateDeparture(houseboatId, departureId, dto, user.id);
  }

  // "Delete" a generated departure = cancel it (status='cancelled'). Hard-delete
  // would FK-violate on crew/holds/bookings and the daily cron would regenerate it.
  // A reason is required — it's shown to affected customers for refund requests.
  @Delete('departures/:departureId')
  @RequirePermission({ module: 'schedule', action: 'edit' })
  cancelDeparture(
    @Param('houseboatId') houseboatId: string,
    @Param('departureId') departureId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CancelDepartureDto,
  ) {
    return this.trips.cancelDeparture(houseboatId, departureId, user.id, dto.reason);
  }

  // Undo a cancellation: flip a cancelled departure back to scheduled.
  @Post('departures/:departureId/revive')
  @RequirePermission({ module: 'schedule', action: 'edit' })
  reviveDeparture(
    @Param('houseboatId') houseboatId: string,
    @Param('departureId') departureId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.trips.reviveDeparture(houseboatId, departureId, user.id);
  }

  // ── Pricing profiles ───────────────────────────────────────
  // Read by the schedule page's slot editor (and the pricing page). Primary
  // owner is schedule since that's its only current consumer.
  @Get('pricing-profiles')
  @RequirePermission({ module: 'schedule', action: 'view', anyOf: ['pricing'] })
  listProfiles(
    @Param('houseboatId') houseboatId: string,
    @Query('route') route?: string,
  ) {
    return this.pricing.listProfiles(houseboatId, route === 'active');
  }

  @Post('pricing-profiles')
  @RequirePermission({ module: 'pricing', action: 'edit' })
  createProfile(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePricingProfileDto,
  ) {
    return this.pricing.createProfile(houseboatId, user.id, dto);
  }

  // ── Per-route pricing (owner pricing page) ─────────────────
  @Get('route-pricing')
  @RequirePermission({ module: 'pricing', action: 'view' })
  listRoutePricing(
    @Param('houseboatId') houseboatId: string,
    @Query('routeId') routeId: string,
  ) {
    return this.pricing.listRoutePricing(houseboatId, routeId);
  }

  @Put('route-pricing')
  @RequirePermission({ module: 'pricing', action: 'edit' })
  upsertRoutePricing(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertRoutePricingDto,
  ) {
    return this.pricing.upsertRoutePricing(houseboatId, user.id, dto);
  }

  // ── Group price bands ──────────────────────────────────────
  // `group-bands-list` (not `group-bands`) for the same reason as departures:
  // the public `GET houseboats/:slug/group-bands` route would otherwise shadow
  // this owner list and 404 on the boat UUID. The POST below has no public twin.
  @Get('group-bands-list')
  @RequirePermission({ module: 'pricing', action: 'view' })
  listBands(@Param('houseboatId') houseboatId: string) {
    return this.pricing.listGroupBands(houseboatId);
  }

  @Post('group-bands')
  @RequirePermission({ module: 'pricing', action: 'edit' })
  addBand(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: GroupBandDto,
  ) {
    return this.pricing.addGroupBand(houseboatId, dto);
  }
}
