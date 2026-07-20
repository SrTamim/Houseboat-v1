import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CurrentUser } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import { CreateQuoteDto, PriceQuoteDto } from './dto/quotes.dto';

/**
 * Group quote requests. Customers request/accept; owners list/price. Owner-side
 * authorization (pricing perm) is enforced in the service since the boat is
 * resolved from the quote id, not always from the route param.
 */
@Controller()
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  // ── Customer ───────────────────────────────────────────────
  @Post('houseboats/:houseboatId/quotes')
  request(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.quotes.request(houseboatId, user.id, dto);
  }

  @Get('me/quotes')
  myQuotes(@CurrentUser() user: AuthUser) {
    return this.quotes.listForCustomer(user.id);
  }

  @Post('quotes/:quoteId/accept')
  accept(@Param('quoteId') quoteId: string, @CurrentUser() user: AuthUser) {
    return this.quotes.accept(quoteId, user.id);
  }

  // ── Owner ──────────────────────────────────────────────────
  @Get('houseboats/:houseboatId/quotes')
  listForBoat(
    @Param('houseboatId') houseboatId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.quotes.listForBoat(houseboatId, user.id, user.isPlatform);
  }

  @Post('quotes/:quoteId/price')
  price(
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: PriceQuoteDto,
  ) {
    return this.quotes.price(quoteId, user.id, user.isPlatform, dto.quotedPrice);
  }
}
