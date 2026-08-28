import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AuditService,
  auditContext,
  type AuditRequestLike,
} from '../audit/audit.service';
import { normalizePhone } from './auth.types';
import {
  PASSWORD_MIN,
  PASSWORD_RULE,
  PASSWORD_RULE_MESSAGE,
} from './dto/auth.dto';

/**
 * Forgot-password via SMS OTP. Independent of AuthService so it can inject the
 * notification + redis stores without widening AuthService's constructor (a
 * unit test constructs that positionally).
 *
 * Storage is entirely in Redis (with RedisService's in-memory fallback), so no
 * schema change is needed. See the security notes on each step.
 */

const OTP_TTL_S = 2 * 60; // code lives 2 minutes
const SEND_WINDOW_S = 10 * 60; // send-limit window
const SEND_MAX = 3; // max sends per ip AND per phone / window
const MAX_VERIFY_ATTEMPTS = 5; // wrong guesses before the code is burned
const TICKET_TTL_S = 10 * 60; // reset ticket validity
const PW_CHANGED_TTL_S = 30 * 24 * 60 * 60; // session-cutoff retention (~refresh life)

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private constantTimeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }

  /**
   * Step 1 — send an OTP. Deliberately non-enumerating: the response is the
   * same whether or not an account exists, and we do comparable work either
   * way. Only a real account triggers an actual SMS.
   */
  async requestOtp(rawPhone: string, ip?: string | null): Promise<void> {
    const phone = normalizePhone(rawPhone);
    const ipBucket = ip ?? 'unknown';
    const phoneBucket = `phone:${phone}`;

    // Dual-keyed send cap: whichever trips first blocks. Phone-keying is the
    // dependable bound (IP collapses through the dev proxy); IP-keying stops
    // SMS-pumping in prod.
    const [ipCount, phoneCount] = await Promise.all([
      this.redis.otpSendCount(ipBucket),
      this.redis.otpSendCount(phoneBucket),
    ]);
    if (ipCount >= SEND_MAX || phoneCount >= SEND_MAX) {
      throw new HttpException(
        'Too many requests. Please try again in 10 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Count the send against both buckets regardless of account existence, so a
    // prober cannot use rate-limit state to distinguish real from fake numbers.
    await Promise.all([
      this.redis.recordOtpSend(ipBucket, SEND_WINDOW_S),
      this.redis.recordOtpSend(phoneBucket, SEND_WINDOW_S),
    ]);

    const account = await this.prisma.account.findUnique({
      where: { phone },
      select: { id: true },
    });

    if (account) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      await this.redis.setOtp(phone, this.hash(code), OTP_TTL_S);
      const message = `${code} is your OTP for bookkoro.xyz\nOTP will expire in 2 minutes.`;
      await this.notifications.sendOtpSms(phone, message);
      if (this.config.get<string>('env') !== 'production') {
        this.logger.debug(`OTP for ${phone}: ${code}`);
      }
      await this.audit.tryLog({
        actorAccountId: account.id,
        action: 'password_reset_requested',
        entityType: 'account',
        entityId: account.id,
        after: { phone },
      });
    }
    // No account: silently do nothing further — same outward response.
  }

  /**
   * Step 2 — verify the code. Expiry is checked before any hash compute. Five
   * wrong guesses burn the code (forces a resend), capping the guessing window.
   * On success the OTP is deleted and a single-use reset ticket is issued.
   */
  async verifyOtp(
    rawPhone: string,
    code: string,
  ): Promise<{ resetTicket: string }> {
    const phone = normalizePhone(rawPhone);
    const record = await this.redis.getOtp(phone);
    if (!record) {
      throw new BadRequestException('This code has expired. Request a new one.');
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      await this.redis.delOtp(phone);
      throw new BadRequestException(
        'Too many attempts. Please request a new code.',
      );
    }

    if (!this.constantTimeEqual(this.hash(code), record.hash)) {
      const attempts = await this.redis.recordOtpAttempt(phone);
      if (attempts >= MAX_VERIFY_ATTEMPTS) await this.redis.delOtp(phone);
      throw new BadRequestException('Wrong OTP. Please try again.');
    }

    // Correct — burn the code and mint a single-use reset ticket.
    await this.redis.delOtp(phone);

    const account = await this.prisma.account.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (!account) {
      // Should not happen (a code only exists for a real account), but never
      // hand out a ticket for a phantom.
      throw new BadRequestException('This code has expired. Request a new one.');
    }

    const jti = randomUUID();
    const resetTicket = await this.jwt.signAsync(
      { sub: account.id, type: 'pwreset', jti },
      {
        secret: this.config.get<string>('auth.jwtSecret'),
        expiresIn: `${TICKET_TTL_S}s`,
      },
    );
    await this.redis.markResetTicket(jti, TICKET_TTL_S);
    return { resetTicket };
  }

  /**
   * Step 3 — set the new password using the reset ticket. The ticket is
   * single-use (consumed here), the password rule is re-validated server-side,
   * lockout is cleared, and a session-cutoff is stamped so any pre-existing
   * session is logged out on its next refresh.
   */
  async resetPassword(
    ticket: string,
    newPassword: string,
    ctx?: AuditRequestLike,
  ): Promise<{ ok: true }> {
    let payload: { sub: string; type: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(ticket, {
        secret: this.config.get<string>('auth.jwtSecret'),
      });
    } catch {
      throw new UnauthorizedException('Reset session expired. Start over.');
    }
    if (payload.type !== 'pwreset' || !payload.jti) {
      throw new UnauthorizedException('Invalid reset session.');
    }

    // Single-use: burn the ticket. A replay finds nothing and is rejected.
    const fresh = await this.redis.consumeResetTicket(payload.jti);
    if (!fresh) {
      throw new UnauthorizedException('This reset link was already used.');
    }

    // Defence in depth — the DTO already enforced this, but never trust it here.
    if (newPassword.length < PASSWORD_MIN || !PASSWORD_RULE.test(newPassword)) {
      throw new BadRequestException(
        `Password must be at least ${PASSWORD_MIN} characters — ${PASSWORD_RULE_MESSAGE}.`,
      );
    }

    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
      select: { id: true, phone: true },
    });
    if (!account) throw new UnauthorizedException('Account no longer exists.');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.account.update({
      where: { id: account.id },
      data: { passwordHash, phoneVerified: true },
    });

    await this.redis.clearLoginFailures(account.phone);
    await this.redis.setPwChanged(
      account.id,
      Math.floor(Date.now() / 1000),
      PW_CHANGED_TTL_S,
    );

    const where = auditContext(ctx);
    await this.audit.tryLog({
      actorAccountId: account.id,
      action: 'password_reset_completed',
      entityType: 'account',
      entityId: account.id,
      ...where,
    });

    return { ok: true };
  }
}
