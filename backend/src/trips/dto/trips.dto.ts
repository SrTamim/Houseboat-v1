import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  IsDateString,
} from 'class-validator';

export class CreatePackageDto {
  @IsString() routeId!: string;
  @IsInt() @Min(1) durationDays!: number;
  @IsOptional() @IsString() durationLabel?: string;
  @IsOptional() @IsString() departureGhat?: string;
  @IsOptional() @IsString() returnGhat?: string;
  @IsOptional() @IsString() meals?: string;
  @IsOptional() @IsString() included?: string;
  @IsOptional() @IsString() excluded?: string;
  @IsOptional() @IsString() cancellationPolicyId?: string;
}

export class CreateDepartureDto {
  @IsString() packageId!: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsString() departureTime?: string; // HH:mm
  @IsOptional() @IsString() arrivalTime?: string;
  @IsOptional() @IsString() pricingProfileId?: string;
}
