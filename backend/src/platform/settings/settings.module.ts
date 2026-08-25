import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';

/**
 * Global so any feature service (holds, auth, billing) can inject SettingsService
 * to read an operational limit without importing this module. PrismaService and
 * AuditService are themselves @Global, so this module needs no imports.
 */
@Global()
@Module({
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
