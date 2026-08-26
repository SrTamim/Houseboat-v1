/**
 * One-off backfill: give every boat its full month-by-month subscription-invoice
 * history, from the boat's created month up to (and including) the current month.
 *
 * Why raw Prisma and not a Nest context: app.module.ts registers
 * ScheduleModule.forRoot(), so bootstrapping AppModule would start the @Cron
 * jobs (the monthly issuer + markOverdue) and let them fire mid-run. This script
 * mirrors prisma/seed.ts's ensureCurrentPeriodInvoice pattern instead — the same
 * per-period logic, no framework side effects.
 *
 * Per boat, per month:
 *   • trial month (period end <= trialEnds)      → $0 'trial' invoice
 *   • current month, post-trial                  → monthly invoice, 'issued' (due now)
 *   • past month, post-trial                     → monthly invoice, 'paid' (history only)
 *
 * Past monthly bills are written 'paid' directly (NOT via paySubscriptionInvoice)
 * so platform_balance is never moved — historical bills were always settled.
 *
 * Idempotent: any (houseboatId, period) already invoiced is skipped, so re-runs
 * are safe.
 *
 * Run: pnpm db:backfill-invoices
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();
const id = () => uuidv7();

/** UTC last instant of a YYYY-MM period (first day of next month − 1ms). */
function periodEnd(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex + 1, 1) - 1);
}

const fmtPeriod = (year: number, monthIndex: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

/**
 */
async function backfillBoat(
  houseboatId: string,
  boatName: string,
  createdAt: Date,
): Promise<void> {
  const config = await prisma.houseboatBillingConfig.findFirst({
    where: { houseboatId },
  });
  if (!config) return;

  const now = new Date();
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth();
  const curPeriod = fmtPeriod(curYear, curMonth);

  // Walk from the boat's created month to the current month, inclusive.
  let year = createdAt.getUTCFullYear();
  let month = createdAt.getUTCMonth();

  const counts = { trial: 0, paid: 0, issued: 0, skipped: 0 };

  while (year < curYear || (year === curYear && month <= curMonth)) {
    const period = fmtPeriod(year, month);

    const existing = await prisma.houseboatSubscriptionInvoice.findFirst({
      where: { houseboatId, period },
      select: { id: true },
    });
    if (existing) {
      counts.skipped++;
    } else {
      const trialActive =
        config.trialEnds != null && config.trialEnds >= periodEnd(year, month);

      if (trialActive) {
        await prisma.houseboatSubscriptionInvoice.create({
          data: {
            id: id(),
            houseboatId,
            billingConfigId: config.id,
            period,
            monthlyFee: null,
            amountDue: 0,
            status: 'trial',
          },
        });
        counts.trial++;
      } else {
        // Fee only — booking commission is already withheld at booking time.
        const amountDue = config.monthlyFee
          ? new Prisma.Decimal(config.monthlyFee)
          : new Prisma.Decimal(0);
        // Current month is genuinely due; older months are historical record.
        const status = period === curPeriod ? 'issued' : 'paid';
        await prisma.houseboatSubscriptionInvoice.create({
          data: {
            id: id(),
            houseboatId,
            billingConfigId: config.id,
            period,
            monthlyFee: config.monthlyFee ?? undefined,
            amountDue,
            status,
          },
        });
        if (status === 'issued') counts.issued++;
        else counts.paid++;
      }
    }

    // Advance one month.
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  console.log(
    `  ${boatName}: +${counts.trial} trial, +${counts.paid} paid, ` +
      `+${counts.issued} issued (${counts.skipped} already present)`,
  );
}

async function main() {
  const configs = await prisma.houseboatBillingConfig.findMany({
    select: {
      houseboatId: true,
      houseboat: { select: { name: true, createdAt: true } },
    },
  });

  console.log(`Backfilling subscription invoices for ${configs.length} boat(s)...`);
  for (const c of configs) {
    await backfillBoat(c.houseboatId, c.houseboat.name, c.houseboat.createdAt);
  }
  console.log('Backfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
