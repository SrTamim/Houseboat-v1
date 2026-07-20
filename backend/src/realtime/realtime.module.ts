import { Global, Module } from '@nestjs/common';
import { AvailabilityGateway } from './availability.gateway';

/**
 * Global so holds/booking/sweeper can emit availability updates without each
 * importing the module.
 */
@Global()
@Module({
  providers: [AvailabilityGateway],
  exports: [AvailabilityGateway],
})
export class RealtimeModule {}
