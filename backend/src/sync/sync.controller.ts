import { Body, Controller, Post } from '@nestjs/common';
import { SyncService } from './sync.service';
import { CurrentUser } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import { SyncBatchDto } from './dto/sync.dto';

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /**
   * Replay a batch of offline intents. Returns a per-intent result plus a
   * human summary ("7 actions synced, 1 needs review").
   */
  @Post('replay')
  replay(@CurrentUser() user: AuthUser, @Body() dto: SyncBatchDto) {
    return this.sync.replay(user.id, user.isPlatform, dto.intents);
  }
}
