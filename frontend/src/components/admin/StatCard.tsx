// KPI stat card — the crafted signature tile (icon chip + label + figure + delta).
// Ported from the .kpi structure produced by _gen.js upgradeKpis(); styled with
// Tailwind utilities (was admin.css `.kpi`). Tokens resolve via globals.css vars.

export type Stat = {
  icon: string;
  label: string;
  value: React.ReactNode; // may include <span className={UNIT}>৳</span>
  delta?: string;
  deltaDir?: 'up' | 'down';
  alert?: boolean;
};

export function StatCard({ icon, label, value, delta, deltaDir, alert }: Stat) {
  // Decorative corner glow (was .kpi::after) — tinted blue, red when alert.
  const glow = alert
    ? "after:[background:radial-gradient(circle,color-mix(in_srgb,var(--danger)_13%,transparent),transparent_70%)]"
    : "after:[background:radial-gradient(circle,color-mix(in_srgb,var(--blue)_12%,transparent),transparent_70%)]";
  // Icon chip gradient (was .kpi .chip) — blue, red when alert.
  const chip = alert
    ? 'text-danger [background:linear-gradient(145deg,color-mix(in_srgb,var(--danger)_20%,var(--raise-1)),color-mix(in_srgb,var(--danger)_9%,var(--raise-1)))] [box-shadow:inset_0_0_0_1px_color-mix(in_srgb,var(--danger)_22%,transparent),var(--top-hi)]'
    : 'text-blue [background:linear-gradient(145deg,color-mix(in_srgb,var(--blue)_22%,var(--raise-1)),color-mix(in_srgb,var(--blue)_10%,var(--raise-1)))] [box-shadow:inset_0_0_0_1px_color-mix(in_srgb,var(--blue)_24%,transparent),var(--top-hi)]';
  return (
    <div
      className={`relative flex min-h-[132px] flex-col overflow-hidden rounded-2xl border border-hair bg-raise-1 p-[18px] shadow-[var(--e2),var(--top-hi)] after:pointer-events-none after:absolute after:-right-10 after:-top-10 after:h-[130px] after:w-[130px] after:rounded-full after:content-[''] ${glow}${
        alert ? ' border-t-2 border-t-danger' : ''
      }`}
    >
      <div className="relative z-[1] flex items-center gap-[11px]">
        <span
          className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] text-[17px] ${chip}`}
        >
          {icon}
        </span>
        <span className="text-[11.5px] font-semibold tracking-[0.01em] text-muted">{label}</span>
      </div>
      <div
        className={`mt-auto pt-[14px] font-display text-[31px] font-semibold leading-none tracking-[-0.035em] tabular-nums ${
          alert ? 'text-danger' : 'text-ink'
        }`}
      >
        {value}
      </div>
      {delta ? (
        <div className="mt-[9px] flex items-center gap-1.5 text-[12px] font-medium leading-[1.35] text-muted">
          <span
            className={
              deltaDir === 'up'
                ? 'flex-none whitespace-nowrap rounded-full bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] px-2 py-0.5 text-[11.5px] font-bold text-ok tabular-nums'
                : deltaDir === 'down'
                  ? 'flex-none whitespace-nowrap rounded-full bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] px-2 py-0.5 text-[11.5px] font-bold text-danger tabular-nums'
                  : 'text-[12px] font-medium text-muted tabular-nums'
            }
          >
            {delta}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(212px,1fr))] gap-4">
      {stats.map((s, i) => (
        <StatCard key={i} {...s} />
      ))}
    </div>
  );
}
