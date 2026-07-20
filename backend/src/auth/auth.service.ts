import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';
import { newId } from '../common/uuid';
import { randomUUID } from 'crypto';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtPayload, normalizePhone } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  private async signTokens(sub: string, isPlatform: boolean) {
    const access = await this.jwt.signAsync(
      { sub, isPlatform, type: 'access' } satisfies JwtPayload,
      {
        secret: this.config.get<string>('auth.jwtSecret'),
        expiresIn: this.config.get<string>('auth.jwtExpiresIn'),
      },
    );
    // Each refresh token carries a unique jti so it can be individually revoked
    // (on logout or rotation). Rotation makes a stolen token single-use.
    const jti = randomUUID();
    const refresh = await this.jwt.signAsync(
      { sub, isPlatform, type: 'refresh', jti } satisfies JwtPayload,
      {
        secret: this.config.get<string>('auth.refreshSecret'),
        expiresIn: this.config.get<string>('auth.refreshExpiresIn'),
      },
    );
    return { access, refresh };
  }

  /** Seconds remaining until a decoded token's exp. Floor 0. */
  private ttlFromExp(exp?: number): number {
    if (!exp) return 0;
    return Math.max(0, exp - Math.floor(Date.now() / 1000));
  }

  async register(dto: RegisterDto) {
    const phone = normalizePhone(dto.phone);
    const existing = await this.prisma.account.findUnique({ where: { phone } });
    if (existing) {
      throw new ConflictException('An account with this phone already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const account = await this.prisma.account.create({
      data: {
        id: newId(),
        phone,
        name: dto.name,
        email: dto.email,
        passwordHash,
      },
      select: { id: true, isPlatform: true, name: true, phone: true, email: true },
    });

    await this.audit.log({
      actorAccountId: account.id,
      action: 'account_register',
      entityType: 'account',
      entityId: account.id,
    });

    const tokens = await this.signTokens(account.id, account.isPlatform);
    return { account, tokens };
  }

  async login(dto: LoginDto) {
    const phone = normalizePhone(dto.phone);
    const account = await this.prisma.account.findUnique({ where: { phone } });
    if (!account || !account.passwordHash) {
      throw new UnauthorizedException('Invalid phone or password');
    }
    const ok = await bcrypt.compare(dto.password, account.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid phone or password');
    }

    await this.audit.log({
      actorAccountId: account.id,
      action: 'account_login',
      entityType: 'account',
      entityId: account.id,
    });

    const tokens = await this.signTokens(account.id, account.isPlatform);
    return {
      account: {
        id: account.id,
        isPlatform: account.isPlatform,
        name: account.name,
        phone: account.phone,
        email: account.email,
      },
      tokens,
    };
  }

  /** Verify a refresh token and issue a fresh access/refresh pair (rotating). */
  async refresh(refreshToken: string) {
    let payload: JwtPayload & { exp?: number };
    try {
      payload = await this.jwt.verifyAsync<JwtPayload & { exp?: number }>(
        refreshToken,
        { secret: this.config.get<string>('auth.refreshSecret') },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Not a refresh token');
    }
    if (!payload.jti) {
      throw new UnauthorizedException('Malformed refresh token');
    }
    // Reject revoked (logged-out or already-rotated) tokens. Fail-closed if the
    // revocation store is unreachable.
    if (await this.redis.isRefreshJtiRevoked(payload.jti)) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
      select: { id: true, isPlatform: true },
    });
    if (!account) throw new UnauthorizedException('Account no longer exists');

    // Rotation: burn the presented token so it can't be reused (single-use).
    await this.redis.revokeRefreshJti(payload.jti, this.ttlFromExp(payload.exp));

    await this.audit.log({
      actorAccountId: account.id,
      action: 'account_token_refresh',
      entityType: 'account',
      entityId: account.id,
    });

    return this.signTokens(account.id, account.isPlatform);
  }

  /** Revoke a refresh token (logout). No-op if the token is already invalid. */
  async revokeRefresh(refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload & { exp?: number }>(
        refreshToken,
        { secret: this.config.get<string>('auth.refreshSecret') },
      );
      if (payload.jti) {
        await this.redis.revokeRefreshJti(payload.jti, this.ttlFromExp(payload.exp));
      }
      await this.audit.log({
        actorAccountId: payload.sub,
        action: 'account_logout',
        entityType: 'account',
        entityId: payload.sub,
      });
    } catch {
      // Invalid/expired token — nothing to revoke.
    }
  }

  async me(accountId: string) {
    return this.prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        phoneVerified: true,
        isPlatform: true,
        createdAt: true,
      },
    });
  }
}
