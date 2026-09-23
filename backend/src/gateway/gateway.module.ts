import { Module } from '@nestjs/common';
import { GatewayController } from './gateway.controller';
import { SslcommerzService } from './sslcommerz.service';
import { MoneyModule } from '../money/money.module';
import { BookingModule } from '../booking/booking.module';

/**
 * Payment gateway (SSLCommerz). Depends on MoneyModule for PaymentsService
 * (recordGatewayPayment, invoice top-ups) and BookingModule for BookingService
 * (confirmIntent — the deposit that creates the booking, audit M-H2).
 */
@Module({
  imports: [MoneyModule, BookingModule],
  controllers: [GatewayController],
  providers: [SslcommerzService],
})
export class GatewayModule {}
