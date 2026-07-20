import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class HoldCabinDto {
  @IsString() cabinId!: string;
  @IsString() departureId!: string;
}

export class CabinSelectionDto {
  @IsString() cabinId!: string;
  @IsString() holdId!: string;
  @IsInt() @Min(1) adults!: number;
  @IsOptional() @IsInt() @Min(0) children?: number;
  /**
   * Ages of the children, so each is charged per the boat's child_policy age
   * bands. If omitted, children are charged full. Length should match children.
   */
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true })
  childAges?: number[];
  /**
   * Opt-in: leave the unfilled places in this cabin as a shared "open seat"
   * bookable by others. Priced at the full-capacity BUYOUT (plan §3); the
   * customer pays only the deposit here.
   */
  @IsOptional() @IsBoolean() openSeat?: boolean;
}

export class CheckoutDto {
  @IsString() departureId!: string;
  @ValidateNested({ each: true })
  @Type(() => CabinSelectionDto)
  @IsArray()
  cabins!: CabinSelectionDto[];

  // Lead guest (captured at checkout for contact).
  @IsString() leadGuestName!: string;
  @IsOptional() @IsString() leadGuestPhone?: string;

  @IsOptional() @IsString() specialInstructions?: string;
  @IsOptional() @IsString() couponCode?: string;
  @IsOptional() @IsString() referenceName?: string;
  /** 'deposit' | 'full' */
  @IsOptional() @IsString() paymentChoice?: string;
  /** Apply the customer's open credits toward this invoice. */
  @IsOptional() @IsBoolean() useCredit?: boolean;
}

export class WaitlistDto {
  @IsString() departureId!: string;
  @IsInt() @Min(1) partySize!: number;
}

export class RescheduleDto {
  @IsString() newDepartureId!: string;
  @IsOptional() @IsString() reason?: string;
}

export class JoinOpenSeatDto {
  @IsString() openSeatCabinId!: string;
  @IsInt() @Min(1) adults!: number;
  @IsOptional() @IsInt() @Min(0) children?: number;
}

export class GroupCheckoutDto {
  @IsString() departureId!: string;
  /** Headcount the customer types; must fall inside a group band. */
  @IsInt() @Min(1) headcount!: number;
  @IsString() leadGuestName!: string;
  @IsOptional() @IsString() leadGuestPhone?: string;
  @IsOptional() @IsString() specialInstructions?: string;
  @IsOptional() @IsString() referenceName?: string;
  @IsOptional() @IsBoolean() useCredit?: boolean;
}
