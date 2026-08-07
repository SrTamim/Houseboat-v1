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
import { HouseboatAdminService } from './houseboat-admin.service';
import { RoutesService } from './routes.service';
import { PlatformBoatsService } from './platform-boats.service';
import { CurrentUser, PlatformOnly } from '../auth/decorators';
import { PlatformPermission } from '../platform/rbac/platform-permission.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AuthUser } from '../auth/auth.types';
import {
  CreateHouseboatDto,
  UpdateHouseboatDto,
  CreateDeckDto,
  CreateCategoryDto,
  CreateCabinDto,
  UpdateDeckDto,
  UpdateCategoryDto,
  UpdateCabinDto,
  CreateRouteDto,
  LinkRouteDto,
  ListBoatsQueryDto,
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

  // ── Owner: edit + delete decks / categories / cabins ───────
  @Patch('houseboats/:houseboatId/decks/:deckId')
  @RequirePermission({ module: 'assets', action: 'edit' })
  updateDeck(
    @Param('houseboatId') houseboatId: string,
    @Param('deckId') deckId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDeckDto,
  ) {
    return this.boats.updateDeck(houseboatId, deckId, user.id, dto);
  }

  @Delete('houseboats/:houseboatId/decks/:deckId')
  @RequirePermission({ module: 'assets', action: 'edit' })
  deleteDeck(
    @Param('houseboatId') houseboatId: string,
    @Param('deckId') deckId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.boats.deleteDeck(houseboatId, deckId, user.id);
  }

  @Patch('houseboats/:houseboatId/categories/:categoryId')
  @RequirePermission({ module: 'assets', action: 'edit' })
  updateCategory(
    @Param('houseboatId') houseboatId: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.boats.updateCategory(houseboatId, categoryId, user.id, dto);
  }

  @Delete('houseboats/:houseboatId/categories/:categoryId')
  @RequirePermission({ module: 'assets', action: 'edit' })
  deleteCategory(
    @Param('houseboatId') houseboatId: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.boats.deleteCategory(houseboatId, categoryId, user.id);
  }

  @Patch('houseboats/:houseboatId/cabins/:cabinId')
  @RequirePermission({ module: 'assets', action: 'edit' })
  updateCabin(
    @Param('houseboatId') houseboatId: string,
    @Param('cabinId') cabinId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCabinDto,
  ) {
    return this.boats.updateCabin(houseboatId, cabinId, user.id, dto);
  }

  @Delete('houseboats/:houseboatId/cabins/:cabinId')
  @RequirePermission({ module: 'assets', action: 'edit' })
  deleteCabin(
    @Param('houseboatId') houseboatId: string,
    @Param('cabinId') cabinId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.boats.deleteCabin(houseboatId, cabinId, user.id);
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
  @PlatformPermission('ops', 'edit')
  @Post('routes')
  createRoute(@Body() dto: CreateRouteDto) {
    return this.routes.create(dto.name, dto.region);
  }

  // ── Platform moderation ────────────────────────────────────
  @PlatformOnly()
  @PlatformPermission('boats', 'view')
  @Get('platform/houseboats')
  listForModeration(@Query() query: ListBoatsQueryDto) {
    return this.platform.listByStatus(query.status);
  }

  @PlatformOnly()
  @PlatformPermission('boats', 'edit')
  @Post('platform/houseboats/:houseboatId/approve')
  approve(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.platform.approve(houseboatId, user.id);
  }

  @PlatformOnly()
  @PlatformPermission('boats', 'edit')
  @Patch('platform/houseboats/:houseboatId/status')
  setStatus(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body('status') status: string,
  ) {
    return this.platform.setStatus(houseboatId, status, user.id);
  }
}
