import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateHouseboatDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() safetyFeatures?: string;
  @IsOptional() @IsString() foodMenu?: string;
}

export class UpdateHouseboatDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() safetyFeatures?: string;
  @IsOptional() @IsString() foodMenu?: string;
  @IsOptional() bankAccount?: unknown;
  @IsOptional() childPolicy?: unknown;
  /** ISO date strings — only these dates generate bookable departures. */
  @IsOptional() @IsArray() operatingDates?: string[];
  @IsOptional() @IsArray() defaultCrew?: string[];
}

export class CreateDeckDto {
  @IsString() name!: string;
  @IsOptional() @IsInt() position?: number;
}

export class CreateCategoryDto {
  @IsString() name!: string;
  @IsOptional() @IsBoolean() isAc?: boolean;
  @IsInt() @Min(1) baseCapacity!: number;
  @IsOptional() @IsInt() @Min(1) extendedCapacity?: number;
  @IsOptional() @IsString() facilities?: string;
}

export class CreateCabinDto {
  @IsString() deckId!: string;
  @IsString() cabinCategoryId!: string;
  @IsString() name!: string;
  @IsOptional() @IsInt() gridRow?: number;
  @IsOptional() @IsInt() gridCol?: number;
}

export class CreateRouteDto {
  @IsString() name!: string;
  @IsOptional() @IsString() region?: string;
}

export class LinkRouteDto {
  @IsString() routeId!: string;
}
