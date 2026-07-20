import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class RecordPaymentDto {
  @IsNumber() @Min(0) amount!: number;
  @IsIn(['gateway', 'cash']) method!: 'gateway' | 'cash';
  @IsOptional() @IsString() gatewayToken?: string;
  @IsOptional() @IsString() receivedBy?: string;
}

export class RefundRequestDto {
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() bankDetails?: unknown;
}

export class CreateCouponDto {
  @IsString() code!: string;
  @IsIn(['percent', 'flat', 'referral']) kind!: 'percent' | 'flat' | 'referral';
  @IsNumber() @Min(0) value!: number;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validTo?: string;
}

export class CreatePolicyDto {
  @IsIn(['flexible', 'moderate', 'strict', 'non_refundable', 'custom'])
  policyTemplate!: string;
  @IsOptional() @IsInt() @Min(0) depositPct?: number;
  @IsOptional() tiers?: unknown;
}

export class RecordDistributionDto {
  @IsString() membershipId!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() note?: string;
}

export class IssueSubscriptionDto {
  /** YYYY-MM */
  @IsString() period!: string;
}
