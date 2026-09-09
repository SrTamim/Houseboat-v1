import {
  NotificationsService,
  NOTIFY_MAX_ATTEMPTS,
} from './notifications.service';

/**
 * Automated retry scan (NotificationsService.runRetryScan). Covers the three
 * outcomes — deliver, back off, give up — plus the guards that keep legacy /
 * unresendable rows out of the scan.
 */
describe('NotificationsService.runRetryScan', () => {
  interface Row {
    id: string;
    accountId: string;
    event: string;
    channel: string;
    delivered: boolean;
    payload: unknown;
    attemptCount: number;
    nextAttemptAt: Date | null;
  }

  function makeService(opts: { due: Row[]; smsOk?: boolean }) {
    const findMany = jest.fn().mockResolvedValue(opts.due);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { notification: { findMany, updateMany } };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const config = {
      get: (key: string) =>
        ({
          'notifications.smsApiUrl': 'https://sms.test/send',
          'notifications.smsApiKey': 'k',
          'notifications.smsSenderId': 'TEST',
        })[key],
    };
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: opts.smsOk ?? true }) as never;
    const svc = new NotificationsService(
      config as never,
      prisma as never,
      audit as never,
    );
    return { svc, findMany, updateMany };
  }

  const baseRow: Row = {
    id: 'n1',
    accountId: 'acct',
    event: 'payment_due',
    channel: 'sms',
    delivered: false,
    payload: { phone: '+8801700000000', message: 'pay please' },
    attemptCount: 0,
    nextAttemptAt: new Date(Date.now() - 1000),
  };

  it('flips delivered and clears nextAttemptAt on a successful retry', async () => {
    const { svc, updateMany } = makeService({ due: [baseRow], smsOk: true });
    const res = await svc.runRetryScan();
    expect(res).toEqual({ retried: 1, delivered: 1 });
    expect(updateMany).toHaveBeenCalledTimes(1);
    const arg = updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'n1', delivered: false });
    expect(arg.data).toEqual({ delivered: true, nextAttemptAt: null });
  });

  it('increments attemptCount and backs off on a failed retry', async () => {
    const { svc, updateMany } = makeService({ due: [baseRow], smsOk: false });
    const res = await svc.runRetryScan();
    expect(res).toEqual({ retried: 1, delivered: 0 });
    const arg = updateMany.mock.calls[0][0];
    expect(arg.data.attemptCount).toEqual({ increment: 1 });
    expect(arg.data.nextAttemptAt).toBeInstanceOf(Date);
    expect((arg.data.nextAttemptAt as Date).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it('gives up (clears nextAttemptAt) at the last attempt, delivered stays false', async () => {
    const lastTry = { ...baseRow, attemptCount: NOTIFY_MAX_ATTEMPTS - 1 };
    const { svc, updateMany } = makeService({ due: [lastTry], smsOk: false });
    await svc.runRetryScan();
    const arg = updateMany.mock.calls[0][0];
    expect(arg.data.attemptCount).toEqual({ increment: 1 });
    expect(arg.data.nextAttemptAt).toBeNull();
  });

  it('treats an incomplete payload as a failed attempt, never throwing', async () => {
    const badRow = { ...baseRow, payload: { message: 'no phone' } };
    const { svc, updateMany } = makeService({ due: [badRow] });
    const res = await svc.runRetryScan();
    expect(res.delivered).toBe(0);
    // Backs off rather than crashing the scan.
    expect(updateMany.mock.calls[0][0].data.attemptCount).toEqual({
      increment: 1,
    });
  });

  it('scans with the payload-not-null + delivered:false + due-time guards', async () => {
    const { svc, findMany } = makeService({ due: [] });
    await svc.runRetryScan();
    const where = findMany.mock.calls[0][0].where;
    expect(where.delivered).toBe(false);
    expect(where.payload).toBeDefined();
    expect(where.attemptCount).toEqual({ lt: NOTIFY_MAX_ATTEMPTS });
    expect(where.nextAttemptAt).toMatchObject({ not: null });
  });
});
