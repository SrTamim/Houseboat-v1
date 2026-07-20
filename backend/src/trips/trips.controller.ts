import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TripsService } from './trips.service';
import { PricingService } from '../pricing/pricing.service';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import { CreatePackageDto, CreateDepartureDto } from './dto/trips.dto';
import { CreatePricingProfileDto, GroupBandDto } from '../pricing/dto/pricing.dto';

@Controller('houseboats/:houseboatId')
export class TripsController {
  constructor(
    private readonly trips: TripsService,
    private readonly pricing: PricingService,
  ) {}

  // ── Packages ───────────────────────────────────────────────
  @Get('packages')
  @RequirePermission({ module: 'trips', action: 'view' })
  listPackages(@Param('houseboatId') houseboatId: string) {
    return this.trips.listPackages(houseboatId);
  }

  @Post('packages')
  @RequirePermission({ module: 'trips', action: 'edit' })
  createPackage(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreatePackageDto,
  ) {
    return this.trips.createPackage(houseboatId, dto);
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

  // ── Pricing profiles ───────────────────────────────────────
  @Get('pricing-profiles')
  @RequirePermission({ module: 'pricing', action: 'view' })
  listProfiles(@Param('houseboatId') houseboatId: string) {
    return this.pricing.listProfiles(houseboatId);
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
