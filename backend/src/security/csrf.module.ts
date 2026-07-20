import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildCsrf } from './csrf';

export const CSRF_UTILS = 'CSRF_UTILS';
export type CsrfUtils = ReturnType<typeof buildCsrf>;

/**
 * Builds the csrf-csrf utilities once from config and shares them app-wide.
 * main.ts pulls CSRF_UTILS to mount doubleCsrfProtection; AuthController pulls
 * it to hand out tokens via generateToken.
 */
@Global()
@Module({
  providers: [
    {
      provide: CSRF_UTILS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): CsrfUtils => {
        const secret = config.get<string>('auth.csrfSecret') ?? '';
        const cookieSecure = config.get<boolean>('auth.cookieSecure') ?? false;
        return buildCsrf(secret, cookieSecure);
      },
    },
  ],
  exports: [CSRF_UTILS],
})
export class CsrfModule {}
