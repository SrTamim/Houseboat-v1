import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

/**
 * Global so booking/gateway/ops can dispatch e-tickets and notices without each
 * importing the module.
 */
@Global()
@Module({
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
