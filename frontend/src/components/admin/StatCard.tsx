// KPI stat card — the crafted signature tile (icon chip + label + figure + delta).
// Ported from the .kpi structure produced by _gen.js upgradeKpis().

export type Stat = {
  icon: string;
  label: string;
  value: React.ReactNode; // may include <span className="u">৳</span>
  delta?: string;
  deltaDir?: 'up' | 'down';
  alert?: boolean;
};

export function StatCard({ icon, label, value, delta, deltaDir, alert }: Stat) {
  return (
    <div className={`kpi${alert ? ' alert' : ''}`}>
      <div className="top">
        <span className="chip">{icon}</span>
        <span className="l">{label}</span>
      </div>
      <div className="n">{value}</div>
      {delta ? (
        <div className="d">
          <span className={`delta${deltaDir ? ' ' + deltaDir : ''}`}>{delta}</span>
        </div>
      ) : null}
    </div>
  );
}

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="kpis">
      {stats.map((s, i) => (
        <StatCard key={i} {...s} />
      ))}
    </div>
  );
}
