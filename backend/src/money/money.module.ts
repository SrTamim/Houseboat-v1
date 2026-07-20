import { Module } from '@nestjs/common';
import { MoneyController } from './money.controller';
import { PaymentsService } from './payments.service';
import { RefundsService } from './refunds.service';
import { PayoutsService } from './payouts.service';
import { CouponsService } from './coupons.service';
import { FinanceService } from './finance.service';

@Module({
  controllers: [MoneyController],
  providers: [
    PaymentsService,
    RefundsService,
    PayoutsService,
    CouponsService,
    FinanceService,
  ],
  exports: [PaymentsService, RefundsService, PayoutsService],
})
export class MoneyModule {}
