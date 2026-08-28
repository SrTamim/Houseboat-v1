import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { newId } from '../common/uuid';

export type NotifyChannel = 'sms' | 'email';

/**
 * Minimal replay payload stored per notification so the console can resend.
 * Holds only contact + message content (already derivable from the account
 * join) — never tokens or bank details. bookingId lets an e-ticket resend
 * regenerate its QR attachment.
 */
export interface NotificationPayload {
  phone?: string;
  email?: string;
  subject?: string;
  html?: string;
  message?: string;
  bookingId?: string;
}

/**
 * Notification delivery. Persists a Notification row per send (delivery audit)
 * and dispatches over SMS (BD HTTP provider) and/or email (SMTP). Delivery is
 * best-effort: a channel failure is logged and marks the row undelivered, never
 * throwing back into the booking/payment flow that triggered it.
 *
 * Providers are optional — if unconfigured, that channel is skipped (dev).
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private mailer: Transporter | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Build the SMTP transport once DI is fully wired (config is guaranteed here;
  // reading it in the constructor is DI-order-fragile).
  onModuleInit(): void {
    const smtpUrl = this.config.get<string>('notifications.smtpUrl');
    if (smtpUrl) {
      this.mailer = nodemailer.createTransport(smtpUrl);
    }
  }

  /**
   * Send an SMS via the configured HTTP provider. No-op if unconfigured.
   *
   * Matches the onecodesoft contract: a GET to /api/send-sms with the params in
   * the query string (api_key, type=text, number, senderid, message). The
   * recipient must be the 88-prefixed number (8801XXXXXXXXX) — an E.164 '+' or a
   * bare local number gets the send rejected. Success is the body ErrorCode
   * (0 or 202), which is authoritative over the HTTP status.
   */
  private async sendSms(to: string, message: string): Promise<boolean> {
    const url = this.config.get<string>('notifications.smsApiUrl');
    const apiKey = this.config.get<string>('notifications.smsApiKey');
    const senderId = this.config.get<string>('notifications.smsSenderId');
    if (!url || !apiKey) return false;

    // Recipient as 88-prefixed digits: strip '+'/spaces, then ensure the 88
    // country code (both '+8801…' and a bare '01…' normalise to '8801…').
    let number = to.replace(/\D/g, '');
    if (!number.startsWith('88')) number = `88${number}`;

    const params = new URLSearchParams({
      api_key: apiKey,
      type: 'text',
      number,
      senderid: senderId ?? '',
      message,
    });

    try {
      const res = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      // Read the body (guarded so a test mock without .text()/.json() still
      // works) so a rejected send is diagnosable instead of a silent no-op.
      let bodyText = '';
      try {
        bodyText = typeof res.text === 'function' ? await res.text() : '';
      } catch {
        /* body unreadable — fall through to the status check */
      }

      // The gateway's numeric code is authoritative over the HTTP status when
      // present (0 = OK for sms-check, 202 = SUBMITTED for send). The field name
      // varies by version, so probe candidates.
      let code: number | undefined;
      if (bodyText) {
        try {
          const parsed = JSON.parse(bodyText) as Record<string, unknown> & {
            results?: { gateway?: { ErrorCode?: unknown } }[];
          };
          const raw =
            parsed.results?.[0]?.gateway?.ErrorCode ??
            (parsed.ErrorCode as unknown) ??
            (parsed.response_code as unknown) ??
            (parsed.error_code as unknown) ??
            (parsed.code as unknown);
          if (raw !== undefined && raw !== null) code = Number(raw);
        } catch {
          /* not JSON — fall back to HTTP status */
        }
      }

      const httpOk = res.status === 200 || res.status === 202 || res.ok;
      const success =
        code !== undefined ? code === 0 || code === 202 : httpOk;

      if (!success) {
        this.logger.warn(
          `SMS send failed [HTTP ${res.status}${code !== undefined ? `, code ${code}` : ''}]: ${bodyText}`,
        );
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`SMS send failed: ${(e as Error).message}`);
      return false;
    }
  }

  /**
   * Send a one-off OTP SMS. Deliberately does NOT write a Notification row —
   * the OTP is a short-lived secret and must never be persisted (unlike
   * booking/payment notices, which record() for the delivery audit).
   */
  async sendOtpSms(phone: string, message: string): Promise<boolean> {
    return this.sendSms(phone, message);
  }

  /**
   * Current SMS provider balance, for the admin System & health page. Returns
   * `{ configured: false }` when SMS is not set up (same early-out as sendSms).
   *
   * The balance endpoint is a DIFFERENT path from the send endpoint, and
   * smsApiUrl is stored as the full send URL — so we use an explicit
   * smsBalanceUrl if given, else derive `{origin}/api/get-balance` from it.
   */
  async getSmsBalance(): Promise<{
    configured: boolean;
    balance?: number | string;
    raw?: unknown;
  }> {
    const apiKey = this.config.get<string>('notifications.smsApiKey');
    const sendUrl = this.config.get<string>('notifications.smsApiUrl');
    if (!apiKey || !sendUrl) return { configured: false };

    let balanceUrl = this.config.get<string>('notifications.smsBalanceUrl');
    if (!balanceUrl) {
      try {
        balanceUrl = `${new URL(sendUrl).origin}/api/get-balance`;
      } catch {
        return { configured: false };
      }
    }

    try {
      const u = new URL(balanceUrl);
      u.searchParams.set('api_key', apiKey);
      const res = await fetch(u.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return { configured: true };
      const raw: unknown = await res.json().catch(() => null);
      const balance = this.pickBalance(raw);
      return { configured: true, balance, raw };
    } catch (e) {
      this.logger.warn(`SMS balance check failed: ${(e as Error).message}`);
      return { configured: true };
    }
  }

  /** Best-effort extraction of a numeric balance from varied provider shapes. */
  private pickBalance(raw: unknown): number | string | undefined {
    if (raw == null) return undefined;
    if (typeof raw === 'number' || typeof raw === 'string') return raw;
    if (typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      const candidate =
        o.balance ??
        o.Balance ??
        o.credit ??
        o.Credit ??
        o.amount ??
        o.Amount ??
        o.data ??
        (o.Data as Record<string, unknown>);
      if (typeof candidate === 'number' || typeof candidate === 'string') {
        return candidate;
      }
      if (candidate && typeof candidate === 'object') {
        const c = candidate as Record<string, unknown>;
        const inner =
          c.balance ?? c.Balance ?? c.credit ?? c.Credit ?? c.amount ?? c.Amount;
        if (typeof inner === 'number' || typeof inner === 'string') return inner;
      }
    }
    return undefined;
  }

  /** Send an email via SMTP. No-op if unconfigured. */
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    attachments?: { filename: string; content: Buffer; cid?: string }[],
  ): Promise<boolean> {
    if (!this.mailer) return false;
    try {
      await this.mailer.sendMail({
        from: this.config.get<string>('notifications.emailFrom'),
        to,
        subject,
        html,
        attachments,
      });
      return true;
    } catch (e) {
      this.logger.warn(`Email send failed: ${(e as Error).message}`);
      return false;
    }
  }

  /** Record a delivery attempt for the audit trail. */
  private async record(
    accountId: string,
    event: string,
    channel: NotifyChannel,
    delivered: boolean,
    payload?: NotificationPayload,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        id: newId(),
        accountId,
        event,
        channel,
        delivered,
        payload: (payload as never) ?? undefined,
      },
    });
  }

  /**
   * Console resend of a recorded notification.
   *
   * Rows created before the payload column exist cannot be replayed → 422.
   * A resend always CREATES a new row (never mutates the original), so the
   * delivery trail stays append-only like everything else money-adjacent.
   */
  async resend(
    notificationId: string,
    actorId: string,
  ): Promise<{ delivered: boolean; notificationId: string }> {
    const original = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!original) throw new NotFoundException('Notification not found');
    const payload = original.payload as NotificationPayload | null;
    if (!payload) {
      throw new UnprocessableEntityException(
        'This notification predates stored payloads and cannot be resent',
      );
    }

    let ok = false;
    if (original.channel === 'sms') {
      if (!payload.phone || !payload.message) {
        throw new UnprocessableEntityException('Stored payload is incomplete');
      }
      ok = await this.sendSms(payload.phone, payload.message);
    } else {
      if (!payload.email) {
        throw new UnprocessableEntityException('Stored payload is incomplete');
      }
      let attachments:
        | { filename: string; content: Buffer; cid?: string }[]
        | undefined;
      if (payload.bookingId && payload.html?.includes('cid:eticketqr')) {
        try {
          const qr = await QRCode.toBuffer(payload.bookingId, { width: 240 });
          attachments = [{ filename: 'ticket.png', content: qr, cid: 'eticketqr' }];
        } catch {
          attachments = undefined;
        }
      }
      ok = await this.sendEmail(
        payload.email,
        payload.subject ?? 'Notification',
        payload.html ?? `<p>${payload.message ?? ''}</p>`,
        attachments,
      );
    }

    const newRowId = newId();
    await this.prisma.notification.create({
      data: {
        id: newRowId,
        accountId: original.accountId,
        event: original.event,
        channel: original.channel,
        delivered: ok,
        payload: original.payload as never,
      },
    });

    await this.audit.log({
      houseboatId: null,
      actorAccountId: actorId,
      action: 'notification_resend',
      entityType: 'notification',
      entityId: notificationId,
      after: { delivered: ok, channel: original.channel, newRowId },
    });

    return { delivered: ok, notificationId: newRowId };
  }

  /**
   * E-ticket after a confirmed, paid booking (plan §11: SMS + email). Includes a
   * QR encoding the booking id for on-boarding scan. Best-effort delivery.
   */
  async sendETicket(params: {
    accountId: string;
    bookingId: string;
    to: { phone?: string; email?: string; name: string };
    boatName: string;
    departureDate: Date;
    displayTotal: string;
    /** Operator (boat) name — shown on the SMS confirmation. Falls back to boatName. */
    operator?: string;
    route?: string;
    /** Departure ghat / boarding location (TripPackage.departureGhat). */
    boarding?: string;
    /** Comma-joined cabin names on this booking. */
    cabin?: string;
    /** Departure time as HH:mm (from the @db.Time field), if set. */
    departureTimeStr?: string;
    /** Whole-taka display amounts (no decimals). */
    displayPaid?: string;
    displayDue?: string;
  }): Promise<void> {
    const dateStr = params.departureDate.toISOString().slice(0, 10);

    // Multi-line SMS confirmation. Optional lines (Boarding/Cabin/time) are
    // dropped entirely when their data is absent rather than printing 'undefined'.
    const dateTime = params.departureTimeStr
      ? `${dateStr} ${params.departureTimeStr}`
      : dateStr;
    const lines: string[] = [
      'Your Trip Booked at bookkoro.xyz',
      '',
      `Operator: ${params.operator ?? params.boatName}`,
    ];
    if (params.route) lines.push(`Route: ${params.route}`);
    lines.push(
      '',
      `Booking ID: ${params.bookingId.slice(0, 8)}`,
      `Date and Time: ${dateTime}`,
    );
    if (params.boarding) lines.push(`Boarding: ${params.boarding}`);
    if (params.cabin) lines.push(`Cabin: ${params.cabin}`);
    lines.push('', `Total: ${params.displayTotal} BDT`);
    if (params.displayPaid !== undefined) {
      lines.push(`Paid: ${params.displayPaid} BDT`);
    }
    if (params.displayDue !== undefined) {
      lines.push(`Due: ${params.displayDue} BDT`);
    }
    lines.push('', 'bookkoro.xyz');
    const smsText = lines.join('\n');

    if (params.to.phone) {
      const ok = await this.sendSms(params.to.phone, smsText);
      await this.record(params.accountId, 'e_ticket', 'sms', ok, {
        phone: params.to.phone,
        message: smsText,
      });
    }

    if (params.to.email) {
      let qrBuffer: Buffer | undefined;
      try {
        qrBuffer = await QRCode.toBuffer(params.bookingId, { width: 240 });
      } catch {
        qrBuffer = undefined;
      }
      const html = `
        <h2>Booking confirmed 🚤</h2>
        <p>Dear ${params.to.name},</p>
        <p>Your booking on <strong>${params.boatName}</strong> for
           <strong>${dateStr}</strong> is confirmed.</p>
        <p>Reference: <strong>${params.bookingId.slice(0, 8)}</strong><br/>
           Total paid: <strong>BDT ${params.displayTotal}</strong></p>
        ${qrBuffer ? `<p><img src="cid:eticketqr" alt="ticket QR" /></p>` : ''}
        <p>Show this at boarding. Bon voyage!</p>`;
      const subject = `Your Houseboat booking — ${params.boatName}`;
      const ok = await this.sendEmail(
        params.to.email,
        subject,
        html,
        qrBuffer
          ? [{ filename: 'ticket.png', content: qrBuffer, cid: 'eticketqr' }]
          : undefined,
      );
      await this.record(params.accountId, 'e_ticket', 'email', ok, {
        email: params.to.email,
        subject,
        html,
        bookingId: params.bookingId,
      });
    }
  }

  /** Simple SMS+email notice (e.g. low stock, refund sent). */
  async notify(params: {
    accountId: string;
    event: string;
    to: { phone?: string; email?: string };
    subject: string;
    message: string;
  }): Promise<void> {
    if (params.to.phone) {
      const ok = await this.sendSms(params.to.phone, params.message);
      await this.record(params.accountId, params.event, 'sms', ok, {
        phone: params.to.phone,
        message: params.message,
      });
    }
    if (params.to.email) {
      const ok = await this.sendEmail(
        params.to.email,
        params.subject,
        `<p>${params.message}</p>`,
      );
      await this.record(params.accountId, params.event, 'email', ok, {
        email: params.to.email,
        subject: params.subject,
        message: params.message,
      });
    }
  }
}
