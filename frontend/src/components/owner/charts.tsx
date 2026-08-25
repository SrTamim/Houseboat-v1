'use client';

/* ────────────────────────────────────────────────────────────
   Owner console charts — dependency-free inline SVG.

   Money arrives as Decimal strings; we parse to Number only for
   pixel geometry (never for display — the labels use the money
   formatter). Colours come from the CSS custom properties defined in
   globals.css so the charts follow the light/dark theme.
   ──────────────────────────────────────────────────────────── */

import { money, moneyShort } from '@/lib/owner/format';

const num = (v: string) => Number(v) || 0;

/* SVG presentation, was the `.chart .*` / `.donut-*` / `.sl-*` descendant rules
   in owner.css. Tailwind can't set SVG stroke/fill from a themed var via a
   utility, so we use arbitrary properties on each node. */
const C_GRID = '[stroke:var(--hair)] [stroke-width:1]';
const C_AXIS_LINE = '[stroke:var(--muted)] opacity-50';
const C_AXIS = '[fill:var(--muted)] text-[11px]';
const C_BAR_REV = '[fill:var(--blue)]';
const C_BAR_COST = '[fill:var(--amber)]';
const C_LINE_PROFIT = '[stroke:var(--ok)] [stroke-width:2]';
const C_DOT_PROFIT = '[fill:var(--ok)]';
const C_BAR_PROFIT = '[fill:var(--ok)]';
const C_BAR_LOSS = '[fill:var(--danger)]';
const C_DONUT_TRACK = '[stroke:var(--chip)]';
const C_DONUT_TOTAL = '[fill:var(--ink)] font-display text-[18px] font-bold';
const C_DONUT_CAP = '[fill:var(--muted)] text-[9px]';
/** Donut slice stroke per key (was `.sl-operating/.sl-crew/.sl-commission`). */
const DONUT_STROKE: Record<string, string> = {
  operating: '[stroke:var(--blue)]',
  crew: '[stroke:var(--amber)]',
  commission: '[stroke:var(--muted)]',
};
/** Legend swatch fill per key + the two bar series (was `.sw-*`). */
const SW_FILL: Record<string, string> = {
  rev: 'bg-blue',
  cost: 'bg-amber',
  profit: 'bg-ok',
  operating: 'bg-blue',
  crew: 'bg-amber',
  commission: 'bg-muted',
};
/** Legend swatch base (was `.sw`). `profit` is a round dot (was `.sw-profit`). */
const SW = 'inline-block h-[11px] w-[11px] flex-none rounded-[3px]';
/** Chart legend row (was `.legend` / `.legend .lg`). */
const LEGEND = 'mt-2.5 flex flex-wrap gap-4 text-[12px] text-bodytext';
const LEGEND_ITEM = 'inline-flex items-center gap-1.5';

function monthShort(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short',
  });
}

interface TrendRow {
  month: string;
  revenue: string;
  totalCost: string;
  profit: string;
  trips: number;
}

/** Grouped bars: revenue vs cost per month, with a profit line on top. */
export function TrendChart({ data }: { data: TrendRow[] }) {
  const W = 720;
  const H = 260;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 28;
  const iw = W - padL - padR;
  const ih = H - padT - padB;

  const max = Math.max(
    1,
    ...data.map((d) => Math.max(num(d.revenue), num(d.totalCost))),
  );
  const y = (v: number) => padT + ih - (v / max) * ih;
  const band = iw / data.length;
  const bw = Math.min(18, band / 3);

  const linePts = data
    .map((d, i) => `${padL + band * i + band / 2},${y(Math.max(0, num(d.profit)))}`)
    .join(' ');

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Revenue, cost and profit over 12 months">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padL}
            x2={W - padR}
            y1={y(max * f)}
            y2={y(max * f)}
            className={C_GRID}
          />
        ))}
        {data.map((d, i) => {
          const cx = padL + band * i + band / 2;
          const rev = num(d.revenue);
          const cost = num(d.totalCost);
          return (
            <g key={d.month}>
              <rect
                x={cx - bw - 1}
                y={y(rev)}
                width={bw}
                height={padT + ih - y(rev)}
                className={C_BAR_REV}
                rx={2}
              >
                <title>{`${monthShort(d.month)} · revenue ${money(d.revenue)}`}</title>
              </rect>
              <rect
                x={cx + 1}
                y={y(cost)}
                width={bw}
                height={padT + ih - y(cost)}
                className={C_BAR_COST}
                rx={2}
              >
                <title>{`${monthShort(d.month)} · cost ${money(d.totalCost)}`}</title>
              </rect>
              <text x={cx} y={H - 8} className={C_AXIS} textAnchor="middle">
                {monthShort(d.month)}
              </text>
            </g>
          );
        })}
        <polyline points={linePts} className={C_LINE_PROFIT} fill="none" />
        {data.map((d, i) => (
          <circle
            key={d.month}
            cx={padL + band * i + band / 2}
            cy={y(Math.max(0, num(d.profit)))}
            r={2.5}
            className={C_DOT_PROFIT}
          >
            <title>{`${monthShort(d.month)} · profit ${money(d.profit)}`}</title>
          </circle>
        ))}
      </svg>
      <div className={LEGEND}>
        <span className={LEGEND_ITEM}><i className={`${SW} ${SW_FILL.rev}`} /> Revenue</span>
        <span className={LEGEND_ITEM}><i className={`${SW} ${SW_FILL.cost}`} /> Total cost</span>
        <span className={LEGEND_ITEM}><i className={`${SW} rounded-full ${SW_FILL.profit}`} /> Profit</span>
      </div>
    </div>
  );
}

/** Per-month profit/loss bars — green above the axis, red below. */
export function ProfitBars({ data }: { data: TrendRow[] }) {
  const W = 720;
  const H = 220;
  const padX = 8;
  const padT = 16;
  const padB = 28;
  const ih = H - padT - padB;

  const max = Math.max(1, ...data.map((d) => Math.abs(num(d.profit))));
  const half = ih / 2;
  const barH = (v: number) => (Math.abs(v) / max) * half;
  const band = (W - padX * 2) / data.length;
  const bw = Math.min(26, band * 0.6);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Profit or loss per month">
        <line x1={padX} x2={W - padX} y1={padT + half} y2={padT + half} className={`${C_GRID} ${C_AXIS_LINE}`} />
        {data.map((d, i) => {
          const v = num(d.profit);
          const cx = padX + band * i + band / 2;
          const h = barH(v);
          const yTop = v >= 0 ? padT + half - h : padT + half;
          return (
            <g key={d.month}>
              <rect
                x={cx - bw / 2}
                y={yTop}
                width={bw}
                height={Math.max(1, h)}
                className={v >= 0 ? C_BAR_PROFIT : C_BAR_LOSS}
                rx={2}
              >
                <title>{`${monthShort(d.month)} · ${money(d.profit)}`}</title>
              </rect>
              <text x={cx} y={H - 8} className={C_AXIS} textAnchor="middle">
                {monthShort(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface Slice {
  key: string;
  label: string;
  amount: string;
}

const DONUT_CLASS: Record<string, string> = {
  operating: 'sl-operating',
  crew: 'sl-crew',
  commission: 'sl-commission',
};

/** Cost breakdown donut with a legend and amounts. */
export function CostDonut({ data }: { data: Slice[] }) {
  const total = data.reduce((s, d) => s + num(d.amount), 0);
  const R = 70;
  const r = 46;
  const cx = 90;
  const cy = 90;
  const C = 2 * Math.PI * ((R + r) / 2);
  const strokeW = R - r;

  let offset = 0;
  const arcs = data.map((d) => {
    const frac = total > 0 ? num(d.amount) / total : 0;
    const len = frac * C;
    const seg = { d, len, offset, frac };
    offset += len;
    return seg;
  });

  return (
    <div className="flex flex-wrap items-center gap-[18px]">
      <svg viewBox="0 0 180 180" className="h-[180px] w-[180px] flex-none" role="img" aria-label="Cost breakdown">
        <circle cx={cx} cy={cy} r={(R + r) / 2} className={C_DONUT_TRACK} fill="none" strokeWidth={strokeW} />
        {total > 0 &&
          arcs.map((a) => (
            <circle
              key={a.d.key}
              cx={cx}
              cy={cy}
              r={(R + r) / 2}
              fill="none"
              strokeWidth={strokeW}
              className={DONUT_STROKE[a.d.key] ?? ''}
              strokeDasharray={`${a.len} ${C - a.len}`}
              strokeDashoffset={-a.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            >
              <title>{`${a.d.label} · ${money(a.d.amount)}`}</title>
            </circle>
          ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className={C_DONUT_TOTAL}>
          {moneyShort(total)}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className={C_DONUT_CAP}>
          total cost + comm.
        </text>
      </svg>
      <ul className="m-0 min-w-[160px] flex-1 list-none p-0">
        {data.map((d) => (
          <li
            key={d.key}
            className="flex items-center gap-2 border-b border-hair py-1.5 text-[13px] last:border-b-0"
          >
            <i className={`${SW} ${SW_FILL[d.key] ?? ''}`} />
            <span className="flex-1 text-bodytext">{d.label}</span>
            <span className="font-semibold text-ink">{money(d.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
