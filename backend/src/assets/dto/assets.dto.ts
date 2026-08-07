import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  LEN_CODE,
  LEN_LONG_TEXT,
  LEN_NAME,
  LEN_TEXT,
} from '../../common/field-limits';

/** Separate meal inputs (§9). Any field may be blank. */
export class FoodMenuDto {
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) breakfast?: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) brunch?: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) lunch?: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) snacks?: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) dinner?: string;
}

/** Structured payout destination (§9). */
export class BankAccountDto {
  @IsOptional() @IsString() @MaxLength(LEN_NAME) bankName?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) accountNo?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) accountHolder?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) district?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) branch?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) routingNumber?: string;
}

/** One child-policy age band. Shape MUST match common/child-policy.ts ChildBand. */
export class ChildBandDto {
  @IsInt() @Min(0) min!: number;
  @IsInt() @Min(0) max!: number;
  @IsInt() @Min(0) chargePct!: number;
}

export class CreateHouseboatDto {
  @IsString() @MaxLength(LEN_NAME) name!: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) description?: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) safetyFeatures?: string;
  @IsOptional() @ValidateNested() @Type(() => FoodMenuDto) foodMenu?: FoodMenuDto;
}

export class UpdateHouseboatDto {
  @IsOptional() @IsString() @MaxLength(LEN_NAME) name?: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) description?: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) safetyFeatures?: string;
  @IsOptional() @ValidateNested() @Type(() => FoodMenuDto) foodMenu?: FoodMenuDto;
  /** Payout destination — structured bank fields (§9). */
  @IsOptional() @ValidateNested() @Type(() => BankAccountDto) bankAccount?: BankAccountDto;
  /** Age bands; empty/omitted → children pay full. Order matters (first match wins). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ChildBandDto)
  childPolicy?: ChildBandDto[];
  /** ISO date strings — only these dates generate bookable departures. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(400) // ~13 months of daily dates
  @IsString({ each: true })
  @MaxLength(LEN_CODE, { each: true })
  operatingDates?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(LEN_CODE, { each: true })
  defaultCrew?: string[];
}

export class CreateDeckDto {
  @IsString() @MaxLength(LEN_NAME) name!: string;
  @IsOptional() @IsInt() position?: number;
}

export class CreateCategoryDto {
  @IsString() @MaxLength(LEN_NAME) name!: string;
  @IsOptional() @IsBoolean() isAc?: boolean;
  @IsInt() @Min(1) baseCapacity!: number;
  @IsOptional() @IsInt() @Min(1) extendedCapacity?: number;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) facilities?: string;
}

export class CreateCabinDto {
  @IsString() @MaxLength(LEN_CODE) deckId!: string;
  @IsString() @MaxLength(LEN_CODE) cabinCategoryId!: string;
  @IsString() @MaxLength(LEN_NAME) name!: string;
  @IsOptional() @IsInt() gridRow?: number;
  @IsOptional() @IsInt() gridCol?: number;
}

// ── Updates: every field optional; only what's sent is changed. ──
export class UpdateDeckDto {
  @IsOptional() @IsString() @MaxLength(LEN_NAME) name?: string;
  @IsOptional() @IsInt() position?: number;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @MaxLength(LEN_NAME) name?: string;
  @IsOptional() @IsBoolean() isAc?: boolean;
  @IsOptional() @IsInt() @Min(1) baseCapacity?: number;
  @IsOptional() @IsInt() @Min(1) extendedCapacity?: number;
  @IsOptional() @IsString() @MaxLength(LEN_TEXT) facilities?: string;
}

export class UpdateCabinDto {
  @IsOptional() @IsString() @MaxLength(LEN_CODE) deckId?: string;
  @IsOptional() @IsString() @MaxLength(LEN_CODE) cabinCategoryId?: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) name?: string;
  @IsOptional() @IsInt() gridRow?: number;
  @IsOptional() @IsInt() gridCol?: number;
}

export class CreateRouteDto {
  @IsString() @MaxLength(LEN_NAME) name!: string;
  @IsOptional() @IsString() @MaxLength(LEN_NAME) region?: string;
}

export class LinkRouteDto {
  @IsString() @MaxLength(LEN_CODE) routeId!: string;
}

/** The lifecycle states a houseboat can be in. */
export const HOUSEBOAT_STATUSES = [
  'draft',
  'pending',
  'live',
  'suspended',
] as const;

/**
 * Filter for the platform moderation queue. Primitive @Query params skip the
 * global ValidationPipe, so an unconstrained string reached Prisma directly —
 * harmless here (it just matched nothing) but it belongs in the contract, and
 * @IsIn makes the valid values discoverable in OpenAPI.
 */
export class ListBoatsQueryDto {
  @IsOptional()
  @IsIn(HOUSEBOAT_STATUSES as unknown as string[])
  status?: (typeof HOUSEBOAT_STATUSES)[number];
}
