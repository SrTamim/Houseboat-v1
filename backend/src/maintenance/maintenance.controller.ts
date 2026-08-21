import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import {
  AddRequestCommentDto,
  CreateMaintenanceRequestDto,
  UpdateMaintenanceRequestDto,
} from './dto/maintenance.dto';

/**
 * Boat maintenance requests. Guarded by the `assets` module — upkeep is care of
 * the asset itself, so anyone who can edit the boat can raise and work requests,
 * and no new permission module was needed.
 */
@Controller('houseboats/:houseboatId/maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get('requests')
  @RequirePermission({ module: 'maintenance', action: 'view' })
  requests(
    @Param('houseboatId') houseboatId: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    return this.maintenance.requestsSummary(houseboatId, { q, status });
  }

  @Post('requests')
  @RequirePermission({ module: 'maintenance', action: 'edit' })
  createRequest(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMaintenanceRequestDto,
  ) {
    return this.maintenance.createRequest(houseboatId, user.id, dto);
  }

  @Patch('requests/:requestId')
  @RequirePermission({ module: 'maintenance', action: 'edit' })
  updateRequest(
    @Param('houseboatId') houseboatId: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMaintenanceRequestDto,
  ) {
    return this.maintenance.updateRequest(houseboatId, requestId, user.id, dto);
  }

  @Post('requests/:requestId/comments')
  @RequirePermission({ module: 'maintenance', action: 'edit' })
  addComment(
    @Param('houseboatId') houseboatId: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AddRequestCommentDto,
  ) {
    return this.maintenance.addRequestComment(houseboatId, requestId, user.id, dto);
  }
}
