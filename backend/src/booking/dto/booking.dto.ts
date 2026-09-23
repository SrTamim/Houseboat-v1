import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LEN_CODE, LEN_NAME, LEN_TEXT } from '../../common/field-limits';
import {
  MAX_CABINS_PER_BOOKING,
  MAX_CHILDREN_PER_CABIN,
} from '../booking.limits';

/**
 * childAges, when supplied, must have exactly `children` entries (audit M-M2).
 * Without this the price loop could be handed more ages than children and charge
 * for children that don't exist, diverging the bill from the manifest. Applied
 * to the childAges field; validates against the sibling `children` count.
 */
function ChildAgesMatchChildren(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'childAgesMatchChildren',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown, args) {
          if (value == null) return true; // optional — omit = charge full
          if (!Array.isArray(value)) return false;
          const children =
            (args?.object as { children?: number } | undefined)?.children ?? 0;
          return value.length === children;
        },
        defaultMessage() {
          return 'childAges must have exactly one age per child';
        },
      },
    });
  };
}

export class HoldCabinDto {
  @IsString() @MaxLength(LEN_CODE) cabinId!: string;
  @IsString() @MaxLength(LEN_CODE) departureId!: string;
}

export class CabinSelectionDto {
  @IsString() @MaxLength(LEN_CODE) cabinId!: string;
  @IsString() @MaxLength(LEN_CODE) holdId!: string;
  @IsInt() @Min(1) adults!: number;
  // Children may exceed the cabin's berth count (they share their parents'
  // beds), so this cap is what stops that being unlimited. Self-service only —
  // owner POS uses its own DTOs and stays uncapped.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CHILDREN_PER_CABIN, {
    message: `You can add up to ${MAX_CHILDREN_PER_CABIN} children per cabin`,
  })
  children?: number;
  /**
   * Ages of the children, so each is charged per the boat's child_policy age
   * bands. If omitted, children are charged full. Length should match children.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CHILDREN_PER_CABIN)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(120, { each: true })
  @ChildAgesMatchChildren()
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
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CHILDREN_PER_CABIN, {
    message: `You can add up to ${MAX_CHILDREN_PER_CABIN} children per cabin`,
  })
  children?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CHILDREN_PER_CABIN)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(120, { each: true })
  @ChildAgesMatchChildren()
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
  // Self-service bookings are capped at MAX_CABINS_PER_BOOKING; the hold route
  // enforces the same limit, so this is the backstop against a hand-crafted
  // request that skips holding. Owner POS uses its own DTO and is uncapped.
  @ArrayMaxSize(MAX_CABINS_PER_BOOKING, {
    message: `You can book up to ${MAX_CABINS_PER_BOOKING} cabins per booking`,
  })
  cabins!: CabinSelectionDto[];

  // Lead guest (captured at checkout for contact).
  @IsString() @MaxLength(LEN_NAME) leadGuestName!: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) leadGuestPhone?: string;
  /** Voucher/e-ticket address. Per-booking: the payer is often not the traveller. */
  @IsOptional() @IsEmail() @MaxLength(254) leadGuestEmail?: string;
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
  /**
   * Wait for one specific cabin. Omitted = any cabin on the trip, which is what
   * every row created before per-cabin waitlisting means.
   */
  @IsOptional() @IsString() @MaxLength(LEN_CODE) cabinId?: string;
}

export class JoinOpenSeatDto {
  @IsString() @MaxLength(LEN_CODE) openSeatCabinId!: string;
  @IsInt() @Min(1) adults!: number;
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_CHILDREN_PER_CABIN, {
    message: `You can add up to ${MAX_CHILDREN_PER_CABIN} children per cabin`,
  })
  children?: number;
  /**
   * Ages of the joiner's children, so each is charged per the boat's child_policy
   * (audit M-M2). Omitted = children charged full, as before. Length must match
   * children when supplied.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CHILDREN_PER_CABIN)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(120, { each: true })
  @ChildAgesMatchChildren()
  childAges?: number[];
}

export class GroupCheckoutDto {
  @IsString() @MaxLength(LEN_CODE) departureId!: string;
  /** Headcount the customer types; must fall inside a group band. */
  @IsInt() @Min(1) headcount!: number;
  @IsString() @MaxLength(LEN_NAME) leadGuestName!: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) leadGuestPhone?: string;
  /** Voucher/e-ticket address. Per-booking: the payer is often not the traveller. */
  @IsOptional() @IsEmail() @MaxLength(254) leadGuestEmail?: string;
  /** Lead guest NID / passport. Stored encrypted at rest; never echoed back. */
  @IsOptional() @IsString() @MaxLength(LEN_CODE) leadGuestNid?: string;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) specialInstructions?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) referenceName?: string;
  @IsOptional() @IsBoolean() useCredit?: boolean;
}

/**
 * A customer's refund request after the owner cancelled their trip. The refund
 * amount is NOT taken from the client (the server refunds the full amount paid);
 * only the payout destination is collected here and stored encrypted at rest.
 */
export class RequestRefundDto {
  @IsIn(['bkash', 'nagad', 'bank'])
  method!: 'bkash' | 'nagad' | 'bank';

  /** bKash/Nagad number, or bank account number. */
  @IsString() @MinLength(3) @MaxLength(64) accountRef!: string;

  /** Account holder name — helps the admin match the transfer. */
  @IsOptional() @IsString() @MaxLength(LEN_NAME) accountName?: string;

  /** Required in practice for method=bank. */
  @IsOptional() @IsString() @MaxLength(120) bankName?: string;
}
