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
  @RequirePermission({ module: 'trips', action: 'view' })
  getSchedule(@Param('houseboatId') houseboatId: string) {
    return this.schedule.getSchedule(houseboatId);
  }

  @Put('schedule')
  @RequirePermission({ module: 'trips', action: 'edit' })
  saveSchedule(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveScheduleDto,
  ) {
    return this.schedule.saveSchedule(houseboatId, user.id, dto);
  }

  // ── Packages ───────────────────────────────────────────────
  @Get('packages')
  @RequirePermission({ module: 'trips', action: 'view' })
  listPackages(
    @Param('houseboatId') houseboatId: string,
    @Query('route') route?: string,
  ) {
    return this.trips.listPackages(houseboatId, route === 'active');
  }

  @Post('packages')
  @RequirePermission({ module: 'trips', action: 'edit' })
  createPackage(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreatePackageDto,
  ) {
    return this.trips.createPackage(houseboatId, dto);
  }

  @Patch('packages/:packageId')
  @RequirePermission({ module: 'trips', action: 'edit' })
  updatePackage(
    @Param('houseboatId') houseboatId: string,
    @Param('packageId') packageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePackageDto,
  ) {
    return this.trips.updatePackage(houseboatId, packageId, dto, user.id);
  }

  @Delete('packages/:packageId')
  @RequirePermission({ module: 'trips', action: 'edit' })
  deletePackage(
    @Param('houseboatId') houseboatId: string,
    @Param('packageId') packageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.trips.deletePackage(houseboatId, packageId, user.id);
  }

  // ── Departures ─────────────────────────────────────────────
  @Get('departures')
  @RequirePermission({ module: 'trips', action: 'view' })
  listDepartures(@Param('houseboatId') houseboatId: string) {
    return this.trips.listDepartures(houseboatId);
  }

  @Post('departures')
  @RequirePermission({ module: 'trips', action: 'edit' })
  createDeparture(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreateDepartureDto,
  ) {
    return this.trips.createDeparture(houseboatId, dto);
  }

  @Patch('departures/:departureId')
  @RequirePermission({ module: 'trips', action: 'edit' })
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
  @RequirePermission({ module: 'trips', action: 'edit' })
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
  @RequirePermission({ module: 'trips', action: 'edit' })
  reviveDeparture(
    @Param('houseboatId') houseboatId: string,
    @Param('departureId') departureId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.trips.reviveDeparture(houseboatId, departureId, user.id);
  }

  // ── Pricing profiles ───────────────────────────────────────
  @Get('pricing-profiles')
  @RequirePermission({ module: 'pricing', action: 'view' })
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
  @Get('group-bands')
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
