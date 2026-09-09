import { Global, Module } from '@nestjs/common';
import { HouseboatFacetsService } from './houseboat-facets.service';

/**
 * Global so pricing / assets / ops / platform services can recompute a boat's
 * denormalized search facets after a mutation without importing HouseboatsModule
 * (which would create circular deps).
 */
@Global()
@Module({
  providers: [HouseboatFacetsService],
  exports: [HouseboatFacetsService],
})
export class HouseboatFacetsModule {}
