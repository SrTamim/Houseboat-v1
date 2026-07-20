import { Controller, Get, Param } from '@nestjs/common';
import { HouseboatsService } from './houseboats.service';
import { Public } from '../auth/decorators';

@Controller('houseboats')
export class HouseboatsController {
  constructor(private readonly houseboats: HouseboatsService) {}

  /** GET /houseboats — public list of live boats. */
  @Public()
  @Get()
  list() {
    return this.houseboats.listLive();
  }

  /** GET /houseboats/:slug — public boat detail. */
  @Public()
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.houseboats.getBySlug(slug);
  }
}
