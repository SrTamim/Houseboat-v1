import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('NotificationsService.resend', () => {
  function makeService(opts: {
    row?: {
      id: string;
      accountId: string;
      event: string;
      channel: string;
      payload: unknown;
    } | null;
    smsOk?: boolean;
  }) {
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const create = jest.fn().mockResolvedValue({});
    const prisma = {
      notification: {
        findUnique: jest.fn().mockResolvedValue(opts.row ?? null),
        create,
      },
    };
    // SMS configured; provider answers per opts.smsOk.
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
    return { svc, prisma, audit, create };
  }

  const smsRow = {
    id: 'n1',
    accountId: 'acct',
    event: 'payment_due',
    channel: 'sms',
    payload: { phone: '+8801700000000', message: 'pay please' },
  };

  it('404s for an unknown notification', async () => {
    const { svc } = makeService({ row: null });
    await expect(svc.resend('ghost', 'admin')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('422s for a legacy row without payload', async () => {
    const { svc } = makeService({ row: { ...smsRow, payload: null } });
    await expect(svc.resend('n1', 'admin')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('re-dispatches SMS and records a NEW row, never mutating the original', async () => {
    const { svc, prisma, create } = makeService({ row: smsRow, smsOk: true });
    const result = await svc.resend('n1', 'admin');
    expect(result.delivered).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.id).not.toBe('n1'); // new row
    expect(data.accountId).toBe('acct');
    expect(data.delivered).toBe(true);
    // No update call exists on the mock at all — the original is untouched.
    expect(
      (prisma.notification as Record<string, unknown>).update,
    ).toBeUndefined();
  });

  it('records delivered=false when the provider fails, still creating a row', async () => {
    const { svc, create } = makeService({ row: smsRow, smsOk: false });
    const result = await svc.resend('n1', 'admin');
    expect(result.delivered).toBe(false);
    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.delivered).toBe(false);
  });

  it('audits the resend with the acting admin', async () => {
    const { svc, audit } = makeService({ row: smsRow });
    await svc.resend('n1', 'admin-7');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'notification_resend',
        actorAccountId: 'admin-7',
        entityId: 'n1',
      }),
    );
  });

  it('422s when an sms payload is missing its phone', async () => {
    const { svc } = makeService({
      row: { ...smsRow, payload: { message: 'x' } },
    });
    await expect(svc.resend('n1', 'admin')).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});
