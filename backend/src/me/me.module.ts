import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { MeService } from './me.service';

/** Customer self-service account surface (wallet, notifications, profile). */
@Module({
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
