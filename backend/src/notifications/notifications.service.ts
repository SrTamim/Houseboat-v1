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

  /** Send an SMS via the configured HTTP provider. No-op if unconfigured. */
  private async sendSms(to: string, message: string): Promise<boolean> {
    const url = this.config.get<string>('notifications.smsApiUrl');
    const apiKey = this.config.get<string>('notifications.smsApiKey');
    const senderId = this.config.get<string>('notifications.smsSenderId');
    if (!url || !apiKey) return false;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, senderid: senderId, to, message }),
      });
      return res.ok;
    } catch (e) {
      this.logger.warn(`SMS send failed: ${(e as Error).message}`);
      return false;
    }
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
  }): Promise<void> {
    const dateStr = params.departureDate.toISOString().slice(0, 10);
    const smsText =
      `Houseboat booking confirmed! ${params.boatName}, ${dateStr}. ` +
      `Ref ${params.bookingId.slice(0, 8)}. Total BDT ${params.displayTotal}.`;

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
