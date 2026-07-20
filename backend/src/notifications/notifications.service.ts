import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../common/uuid';

export type NotifyChannel = 'sms' | 'email';

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
  ): Promise<void> {
    await this.prisma.notification.create({
      data: { id: newId(), accountId, event, channel, delivered },
    });
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
      await this.record(params.accountId, 'e_ticket', 'sms', ok);
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
      const ok = await this.sendEmail(
        params.to.email,
        `Your Houseboat booking — ${params.boatName}`,
        html,
        qrBuffer
          ? [{ filename: 'ticket.png', content: qrBuffer, cid: 'eticketqr' }]
          : undefined,
      );
      await this.record(params.accountId, 'e_ticket', 'email', ok);
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
      await this.record(params.accountId, params.event, 'sms', ok);
    }
    if (params.to.email) {
      const ok = await this.sendEmail(
        params.to.email,
        params.subject,
        `<p>${params.message}</p>`,
      );
      await this.record(params.accountId, params.event, 'email', ok);
    }
  }
}
