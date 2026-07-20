import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { HouseboatAdminService } from './houseboat-admin.service';
import { RoutesService } from './routes.service';
import { PlatformBoatsService } from './platform-boats.service';
import { CurrentUser, PlatformOnly } from '../auth/decorators';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AuthUser } from '../auth/auth.types';
import {
  CreateHouseboatDto,
  UpdateHouseboatDto,
  CreateDeckDto,
  CreateCategoryDto,
  CreateCabinDto,
  CreateRouteDto,
  LinkRouteDto,
} from './dto/assets.dto';

@Controller()
export class AssetsController {
  constructor(
    private readonly boats: HouseboatAdminService,
    private readonly routes: RoutesService,
    private readonly platform: PlatformBoatsService,
  ) {}

  // ── Owner: create + manage a boat ──────────────────────────
  // Create needs only auth (no boat yet); creator becomes Owner.
  @Post('houseboats')
  createBoat(@CurrentUser() user: AuthUser, @Body() dto: CreateHouseboatDto) {
    return this.boats.create(user.id, dto);
  }

  @Get('houseboats/:houseboatId/manage')
  @RequirePermission({ module: 'assets', action: 'view' })
  getBoat(@Param('houseboatId') houseboatId: string) {
    return this.boats.get(houseboatId);
  }

  @Patch('houseboats/:houseboatId')
  @RequirePermission({ module: 'assets', action: 'edit' })
  updateBoat(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateHouseboatDto,
  ) {
    return this.boats.update(houseboatId, user.id, dto);
  }

  @Post('houseboats/:houseboatId/decks')
  @RequirePermission({ module: 'assets', action: 'edit' })
  addDeck(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreateDeckDto,
  ) {
    return this.boats.addDeck(houseboatId, dto);
  }

  @Post('houseboats/:houseboatId/categories')
  @RequirePermission({ module: 'assets', action: 'edit' })
  addCategory(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.boats.addCategory(houseboatId, dto);
  }

  @Post('houseboats/:houseboatId/cabins')
  @RequirePermission({ module: 'assets', action: 'edit' })
  addCabin(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: CreateCabinDto,
  ) {
    return this.boats.addCabin(houseboatId, dto);
  }

  @Post('houseboats/:houseboatId/routes')
  @RequirePermission({ module: 'assets', action: 'edit' })
  linkRoute(
    @Param('houseboatId') houseboatId: string,
    @Body() dto: LinkRouteDto,
  ) {
    return this.boats.linkRoute(houseboatId, dto.routeId);
  }

  // ── Routes: read open to any authed user; writes platform-only ─
  @Get('routes')
  listRoutes() {
    return this.routes.listActive();
  }

  @PlatformOnly()
  @Post('routes')
  createRoute(@Body() dto: CreateRouteDto) {
    return this.routes.create(dto.name, dto.region);
  }

  // ── Platform moderation ────────────────────────────────────
  @PlatformOnly()
  @Get('platform/houseboats')
  listForModeration(@Query('status') status?: string) {
    return this.platform.listByStatus(status);
  }

  @PlatformOnly()
  @Post('platform/houseboats/:houseboatId/approve')
  approve(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.platform.approve(houseboatId, user.id);
  }

  @PlatformOnly()
  @Patch('platform/houseboats/:houseboatId/status')
  setStatus(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body('status') status: string,
  ) {
    return this.platform.setStatus(houseboatId, status, user.id);
  }
}
