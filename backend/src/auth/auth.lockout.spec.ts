import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Progressive login lockout (G4). After enough consecutive failures for one
 * phone the service refuses further attempts within the window — defending a
 * single account against distributed credential stuffing that the per-IP
 * @Throttle cannot see. Success clears the counter.
 */
describe('AuthService — login lockout', () => {
  function makeService(opts: { failCount?: number; account?: unknown }) {
    const redis = {
      loginFailCount: jest.fn().mockResolvedValue(opts.failCount ?? 0),
      recordLoginFailure: jest.fn().mockResolvedValue((opts.failCount ?? 0) + 1),
      clearLoginFailures: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue(opts.account ?? null) },
    };
    const audit = {
      log: jest.fn().mockResolvedValue(undefined),
      tryLog: jest.fn().mockResolvedValue(undefined),
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('tok') };
    const config = { get: jest.fn().mockReturnValue('secret') };
    const svc = new AuthService(
      prisma as never,
      jwt as never,
      config as never,
      audit as never,
      redis as never,
    );
    return { svc, redis, prisma };
  }

  it('refuses login once the failure count is at the threshold (locked)', async () => {
    const { svc, prisma } = makeService({ failCount: 8 });
    await expect(
      svc.login({ phone: '01712345678', password: 'whatever1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    // Locked out BEFORE any account lookup / password compare.
    expect(prisma.account.findUnique).not.toHaveBeenCalled();
  });

  it('records a failure on a bad password (feeds the counter)', async () => {
    const { svc, redis } = makeService({
      failCount: 0,
      account: { id: 'a1', passwordHash: '$2a$12$notmatching', isPlatform: false },
    });
    await expect(
      svc.login({ phone: '01712345678', password: 'wrongpass1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(redis.recordLoginFailure).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number),
    );
  });

  it('records a failure for an unknown account too (no enumeration shortcut)', async () => {
    const { svc, redis } = makeService({ failCount: 0, account: null });
    await expect(
      svc.login({ phone: '01712345678', password: 'wrongpass1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(redis.recordLoginFailure).toHaveBeenCalled();
  });
});
