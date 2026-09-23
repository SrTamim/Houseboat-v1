import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { LEN_CODE } from '../../common/field-limits';

/**
 * Pay against EITHER a booking intent (first deposit — creates the booking on
 * confirmation, audit M-H2) OR an existing invoice (top-up of the remaining
 * balance on a booking already made). Exactly one of intentId / invoiceId.
 */
export class InitiatePaymentDto {
  /** A BookingIntent awaiting its deposit. Creates the booking when paid. */
  @IsOptional() @IsUUID() intentId?: string;
  /** An existing invoice to top up (remaining balance). */
  @IsOptional() @IsUUID() invoiceId?: string;
  /** Optional partial (deposit) amount. Defaults to the full outstanding/total. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() amount?: number;
}

/**
 * SSLCommerz IPN payload. It posts many fields; we only rely on val_id and
 * re-validate server-to-server, so the rest are accepted loosely. whitelist
 * strips anything not declared here — keep the fields we read.
 *
 * This endpoint is @Public() and reachable by anyone, so every field is
 * length-bounded even though the values are re-verified out-of-band.
 */
export class SslcommerzIpnDto {
  @IsOptional() @IsString() @MaxLength(LEN_CODE) val_id?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) tran_id?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) status?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) amount?: string;
}
