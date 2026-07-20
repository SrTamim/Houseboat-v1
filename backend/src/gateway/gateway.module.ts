import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { SslcommerzService } from './sslcommerz.service';
import { MoneyModule } from '../money/money.module';

/**
 * Payment gateway (SSLCommerz). Depends on MoneyModule for PaymentsService
 * (which exposes recordGatewayPayment for the IPN path).
 */
@Module({
  imports: [MoneyModule],
  controllers: [GatewayController],
  providers: [SslcommerzService],
})
export class GatewayModule {}
