import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * SSLCommerz (Bangladesh) integration. Two calls we make server-to-server:
 *  1. initiate — POST the order to gwprocess; returns a hosted GatewayPageURL we
 *     redirect the customer to.
 *  2. validate — after the IPN/redirect, confirm the payment by val_id against
 *     the validator API. THIS is authoritative; never trust the raw POST body.
 *
 * Sandbox and live differ only by host + credentials.
 */
@Injectable()
export class SslcommerzService {
  private readonly logger = new Logger(SslcommerzService.name);

  constructor(private readonly config: ConfigService) {}

  private get creds() {
    const storeId = this.config.get<string>('gateway.storeId');
    const storePassword = this.config.get<string>('gateway.storePassword');
    if (!storeId || !storePassword) {
      throw new BadRequestException('Payment gateway is not configured');
    }
    return { storeId, storePassword };
  }

  private get baseHost(): string {
    return this.config.get<boolean>('gateway.sandbox')
      ? 'https://sandbox.sslcommerz.com'
      : 'https://securepay.sslcommerz.com';
  }

  /**
   * Create a hosted checkout session. tranId must be unique per attempt and let
   * us correlate the IPN back to the invoice — we use `${invoiceId}:${nonce}`.
   */
  async initiate(params: {
    invoiceId: string;
    tranId: string;
    amount: number;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
  }): Promise<{ gatewayPageUrl: string }> {
    const { storeId, storePassword } = this.creds;
    const apiBase = this.config.get<string>('apiPublicUrl');

    const form = new URLSearchParams({
      store_id: storeId,
      store_passwd: storePassword,
      total_amount: params.amount.toFixed(2),
      currency: 'BDT',
      tran_id: params.tranId,
      // Gateway redirects the browser here; the IPN (below) is the source of
      // truth, these are just UX landing pages.
      success_url: `${apiBase}/api/gateway/sslcommerz/return`,
      fail_url: `${apiBase}/api/gateway/sslcommerz/return`,
      cancel_url: `${apiBase}/api/gateway/sslcommerz/return`,
      ipn_url: `${apiBase}/api/gateway/sslcommerz/ipn`,
      cus_name: params.customerName,
      cus_phone: params.customerPhone,
      cus_email: params.customerEmail ?? 'na@houseboat.local',
      product_name: 'Houseboat booking',
      product_category: 'travel',
      product_profile: 'general',
      shipping_method: 'NO',
    });

    const res = await fetch(`${this.baseHost}/gwprocess/v4/api.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = (await res.json()) as {
      status?: string;
      GatewayPageURL?: string;
      failedreason?: string;
    };
    if (data.status !== 'SUCCESS' || !data.GatewayPageURL) {
      this.logger.warn(`SSLCommerz initiate failed: ${data.failedreason}`);
      throw new BadRequestException('Could not start payment');
    }
    return { gatewayPageUrl: data.GatewayPageURL };
  }

  /**
   * Authoritative confirmation. Given a val_id from the IPN, ask SSLCommerz for
   * the real transaction record. Returns the validated amount + tran_id, or null
   * if not a valid/completed payment.
   */
  async validate(valId: string): Promise<{
    tranId: string;
    amount: number;
    valId: string;
  } | null> {
    const { storeId, storePassword } = this.creds;
    const url = new URL(
      `${this.baseHost}/validator/api/validationserverAPI.php`,
    );
    url.searchParams.set('val_id', valId);
    url.searchParams.set('store_id', storeId);
    url.searchParams.set('store_passwd', storePassword);
    url.searchParams.set('format', 'json');

    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      status?: string;
      tran_id?: string;
      amount?: string;
      val_id?: string;
    };
    // VALID or VALIDATED both mean the money moved.
    if (
      (data.status === 'VALID' || data.status === 'VALIDATED') &&
      data.tran_id &&
      data.amount &&
      data.val_id
    ) {
      return {
        tranId: data.tran_id,
        amount: Number(data.amount),
        valId: data.val_id,
      };
    }
    return null;
  }
}
