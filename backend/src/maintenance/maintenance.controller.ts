import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import {
  CompleteTaskDto,
  CreateDamageDto,
  CreateMaintenanceTaskDto,
  CreateServiceLogDto,
  SetEngineHoursDto,
  UpdateDamageDto,
  UpdateMaintenanceTaskDto,
} from './dto/maintenance.dto';

/**
 * Boat maintenance. Guarded by the `assets` module — upkeep is care of the
 * asset itself, so anyone who can edit the boat can service it, and no new
 * permission module was needed.
 */
@Controller('houseboats/:houseboatId/maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  @RequirePermission({ module: 'assets', action: 'view' })
  summary(@Param('houseboatId') houseboatId: string) {
    return this.maintenance.summary(houseboatId);
  }

  // ── Service schedule ───────────────────────────────────────
  @Post('tasks')
  @RequirePermission({ module: 'assets', action: 'edit' })
  createTask(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMaintenanceTaskDto,
  ) {
    return this.maintenance.createTask(houseboatId, user.id, dto);
  }

  @Patch('tasks/:taskId')
  @RequirePermission({ module: 'assets', action: 'edit' })
  updateTask(
    @Param('houseboatId') houseboatId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMaintenanceTaskDto,
  ) {
    return this.maintenance.updateTask(houseboatId, taskId, user.id, dto);
  }

  @Post('tasks/:taskId/complete')
  @RequirePermission({ module: 'assets', action: 'edit' })
  completeTask(
    @Param('houseboatId') houseboatId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CompleteTaskDto,
  ) {
    return this.maintenance.completeTask(houseboatId, taskId, user.id, dto);
  }

  @Post('service-logs')
  @RequirePermission({ module: 'assets', action: 'edit' })
  addServiceLog(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateServiceLogDto,
  ) {
    return this.maintenance.addServiceLog(houseboatId, user.id, dto);
  }

  // ── Damage log ─────────────────────────────────────────────
  @Get('damage')
  @RequirePermission({ module: 'assets', action: 'view' })
  listDamage(@Param('houseboatId') houseboatId: string) {
    return this.maintenance.listDamage(houseboatId);
  }

  @Post('damage')
  @RequirePermission({ module: 'assets', action: 'edit' })
  reportDamage(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDamageDto,
  ) {
    return this.maintenance.reportDamage(houseboatId, user.id, dto);
  }

  @Patch('damage/:damageId')
  @RequirePermission({ module: 'assets', action: 'edit' })
  updateDamage(
    @Param('houseboatId') houseboatId: string,
    @Param('damageId') damageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDamageDto,
  ) {
    return this.maintenance.updateDamage(houseboatId, damageId, user.id, dto);
  }

  // ── Engine hour meter ──────────────────────────────────────
  @Post('engine-hours')
  @RequirePermission({ module: 'assets', action: 'edit' })
  setEngineHours(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetEngineHoursDto,
  ) {
    return this.maintenance.setEngineHours(houseboatId, user.id, dto.hours);
  }
}
