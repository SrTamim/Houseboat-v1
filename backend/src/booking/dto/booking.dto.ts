import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LEN_CODE, LEN_NAME, LEN_TEXT } from '../../common/field-limits';

export class HoldCabinDto {
  @IsString() @MaxLength(LEN_CODE) cabinId!: string;
  @IsString() @MaxLength(LEN_CODE) departureId!: string;
}

export class CabinSelectionDto {
  @IsString() @MaxLength(LEN_CODE) cabinId!: string;
  @IsString() @MaxLength(LEN_CODE) holdId!: string;
  @IsInt() @Min(1) adults!: number;
  @IsOptional() @IsInt() @Min(0) children?: number;
  /**
   * Ages of the children, so each is charged per the boat's child_policy age
   * bands. If omitted, children are charged full. Length should match children.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(120, { each: true })
  childAges?: number[];
  /**
   * Opt-in: leave the unfilled places in this cabin as a shared "open seat"
   * bookable by others. Priced at the full-capacity BUYOUT (plan §3); the
   * customer pays only the deposit here.
   */
  @IsOptional() @IsBoolean() openSeat?: boolean;
}

/**
 * A cabin selection for a price quote — same as CabinSelectionDto but WITHOUT
 * a holdId. Quotes are hold-free (they price a hypothetical selection before the
 * customer commits), so no cabin is locked and no hold exists yet.
 */
export class QuoteCabinDto {
  @IsString() @MaxLength(LEN_CODE) cabinId!: string;
  @IsInt() @Min(1) adults!: number;
  @IsOptional() @IsInt() @Min(0) children?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(120, { each: true })
  childAges?: number[];
  @IsOptional() @IsBoolean() openSeat?: boolean;
}

export class QuoteDto {
  @IsString() @MaxLength(LEN_CODE) departureId!: string;
  @ValidateNested({ each: true })
  @Type(() => QuoteCabinDto)
  @IsArray()
  @ArrayMaxSize(50)
  cabins!: QuoteCabinDto[];
  @IsOptional() @IsString() @MaxLength(LEN_CODE) couponCode?: string;
}

export class CheckoutDto {
  @IsString() @MaxLength(LEN_CODE) departureId!: string;
  @ValidateNested({ each: true })
  @Type(() => CabinSelectionDto)
  @IsArray()
  @ArrayMaxSize(50) // more cabins than any single boat has
  cabins!: CabinSelectionDto[];

  // Lead guest (captured at checkout for contact).
  @IsString() @MaxLength(LEN_NAME) leadGuestName!: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) leadGuestPhone?: string;
  /** Lead guest NID / passport. Stored encrypted at rest; never echoed back. */
  @IsOptional() @IsString() @MaxLength(LEN_CODE) leadGuestNid?: string;

  @IsOptional() @IsString() @MaxLength(LEN_TEXT) specialInstructions?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) couponCode?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) referenceName?: string;
  /** 'deposit' | 'full' */
  @IsOptional() @IsString() @MaxLength(LEN_CODE) paymentChoice?: string;
  /** Apply the customer's open credits toward this invoice. */
  @IsOptional() @IsBoolean() useCredit?: boolean;
}

export class WaitlistDto {
  @IsString() @MaxLength(LEN_CODE) departureId!: string;
  @IsInt() @Min(1) partySize!: number;
}

export class RescheduleDto {
  @IsString() @MaxLength(LEN_CODE) newDepartureId!: string;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) reason?: string;
}

export class JoinOpenSeatDto {
  @IsString() @MaxLength(LEN_CODE) openSeatCabinId!: string;
  @IsInt() @Min(1) adults!: number;
  @IsOptional() @IsInt() @Min(0) children?: number;
}

export class GroupCheckoutDto {
  @IsString() @MaxLength(LEN_CODE) departureId!: string;
  /** Headcount the customer types; must fall inside a group band. */
  @IsInt() @Min(1) headcount!: number;
  @IsString() @MaxLength(LEN_NAME) leadGuestName!: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) leadGuestPhone?: string;
  /** Lead guest NID / passport. Stored encrypted at rest; never echoed back. */
  @IsOptional() @IsString() @MaxLength(LEN_CODE) leadGuestNid?: string;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) specialInstructions?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) referenceName?: string;
  @IsOptional() @IsBoolean() useCredit?: boolean;
}
