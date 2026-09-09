import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { HouseboatsService } from './houseboats.service';
import { SearchHouseboatsDto, SearchResultsDto } from './dto/search.dto';
import { CurrentUser, Public } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import { readGuestToken } from '../booking/guest-token';

/** Parse an optional YYYY-MM-DD query param into a Date, or undefined. */
function parseDate(value: string | undefined, field: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid ${field} date`);
  }
  return d;
}

@Controller('houseboats')
export class HouseboatsController {
  constructor(private readonly houseboats: HouseboatsService) {}

  /** GET /houseboats — public list of live boats. */
  @Public()
  @Get()
  list() {
    return this.houseboats.listLive();
  }

  /**
   * GET /houseboats/search — public filtered search. Static path, declared
   * before the `:slug` catch-all so "search" isn't read as a slug.
   */
  @Public()
  @Get('search')
  search(@Query() query: SearchHouseboatsDto) {
    return this.houseboats.search(query);
  }

  /**
   * GET /houseboats/search/results — DB-side filtered, sorted, paginated search
   * returning { items, total, page, pageSize, facets }. Static path declared
   * before `:slug`. Distinct from the bare /houseboats/search flat array (which
   * the home page still uses), so this shape change is non-breaking.
   */
  @Public()
  @Get('search/results')
  searchResults(@Query() query: SearchResultsDto) {
    return this.houseboats.searchResults(query);
  }

  /**
   * GET /houseboats/:slug/departures?from&to — public bookable departures.
   * Declared before `:slug` so the more specific path wins.
   */
  @Public()
  @Get(':slug/departures')
  departures(
    @Param('slug') slug: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.houseboats.listDepartures(
      slug,
      parseDate(from, 'from'),
      parseDate(to, 'to'),
    );
  }

  /** GET /houseboats/:slug/group-bands — public full-boat buyout bands. */
  @Public()
  @Get(':slug/group-bands')
  groupBands(@Param('slug') slug: string) {
    return this.houseboats.listGroupBands(slug);
  }

  /**
   * GET /houseboats/:slug/departures/:departureId/cabins — public per-cabin
   * availability snapshot for the boat detail page. Declared before `:slug` so
   * the more specific path wins.
   */
  @Public()
  @Get(':slug/departures/:departureId/cabins')
  departureCabins(
    @Param('slug') slug: string,
    @Param('departureId') departureId: string,
    @CurrentUser() user: AuthUser | undefined,
    @Req() req: Request,
  ) {
    // Identify the viewer so their OWN hold comes back as held_by_me instead of
    // "booked". Read-only: deliberately readGuestToken, never ensureGuestToken —
    // minting a cookie on a page-view read would tag visitors who never book.
    return this.houseboats.departureCabinAvailability(slug, departureId, {
      accountId: user?.id ?? null,
      guestToken: readGuestToken(req),
    });
  }

  /** GET /houseboats/:slug — public boat detail. */
  @Public()
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.houseboats.getBySlug(slug);
  }
}
