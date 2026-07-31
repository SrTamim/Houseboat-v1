import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  LEN_CODE,
  LEN_LONG_TEXT,
  LEN_NAME,
  LEN_TEXT,
} from '../../common/field-limits';

export class CreateHouseboatDto {
  @IsString() @MaxLength(LEN_NAME) name!: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) description?: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) safetyFeatures?: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) foodMenu?: string;
}

export class UpdateHouseboatDto {
  @IsOptional() @IsString() @MaxLength(LEN_NAME) name?: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) description?: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) safetyFeatures?: string;
  @IsOptional() @IsString() @MaxLength(LEN_LONG_TEXT) foodMenu?: string;
  /** Payout destination; shape is bank-dependent. */
  @IsOptional() @IsObject() bankAccount?: Record<string, unknown>;
  @IsOptional() @IsObject() childPolicy?: Record<string, unknown>;
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
