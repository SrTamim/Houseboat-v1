import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class InitiatePaymentDto {
  @IsUUID() invoiceId!: string;
  /** Optional partial (deposit) amount. Defaults to the full outstanding. */
  @IsOptional() @IsNumber() @IsPositive() amount?: number;
}

/**
 * SSLCommerz IPN payload. It posts many fields; we only rely on val_id and
 * re-validate server-to-server, so the rest are accepted loosely. whitelist
 * strips anything not declared here — keep the fields we read.
 */
export class SslcommerzIpnDto {
  @IsOptional() @IsString() val_id?: string;
  @IsOptional() @IsString() tran_id?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() amount?: string;
}
