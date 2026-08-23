import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { HoldsService } from '../booking/holds.service';

/**
 * Global so JwtAuthGuard (registered app-wide as an APP_GUARD) and JwtService
 * are available everywhere without re-importing.
 *
 * HoldsService is provided directly rather than by importing BookingModule:
 * this module is @Global() and BookingModule depends on it, so importing back
 * would close a cycle. Same pattern as StorageService in HouseboatsModule.
 * Login uses it to claim a guest's cabin holds onto the account.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, HoldsService],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
