import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Customer cash-out request. The amount is NOT taken from the client — the
 * server always cashes out the caller's full open balance, so a tampered amount
 * can't over-withdraw.
 */
export class CreateCashoutDto {
  @IsIn(['bkash', 'nagad', 'bank'])
  method!: 'bkash' | 'nagad' | 'bank';

  /** bKash/Nagad number, or bank account number. */
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  accountRef!: string;

  /** Required in practice for method=bank; validated in the service. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;
}
