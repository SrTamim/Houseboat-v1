import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { MeService } from './me.service';
import { CurrentUser } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Customer "my account" surface. Auth-required (no @Public); every action is
 * scoped to the caller's own account id. Note: GET /me/notifications is served
 * by the ops controller (also scoped by user.id) — not duplicated here.
 */
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  /** GET /me/credits — wallet balance + credit history. */
  @Get('credits')
  credits(@CurrentUser() user: AuthUser) {
    return this.me.credits(user.id);
  }

  /** GET /me/invoices/:id — one of the caller's own invoices (payment poll). */
  @Get('invoices/:id')
  invoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.me.invoice(user.id, id);
  }

  /** POST /me/notifications/:id/read — mark one inbox item read. */
  @Post('notifications/:id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.me.markNotificationRead(user.id, id);
  }

  /** PATCH /me — update the caller's own profile. */
  @Patch()
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.me.updateProfile(user.id, dto);
  }
}
