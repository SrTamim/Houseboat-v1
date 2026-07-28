// Small presentational helpers shared across admin pages.

export function PageHead({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {desc ? <p>{desc}</p> : null}
      </div>
      {actions ? <div className="acts">{actions}</div> : null}
    </div>
  );
}

export function Card({
  title,
  sub,
  head,
  flush = false,
  children,
  style,
}: {
  title?: string;
  sub?: React.ReactNode;
  head?: React.ReactNode;
  flush?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="card2" style={style}>
      {title || head ? (
        <div className="ch">
          {title ? <h3>{title}</h3> : null}
          {sub ? <span className="sub">{sub}</span> : null}
          {head}
        </div>
      ) : null}
      <div className={`cb${flush ? ' flush' : ''}`}>{children}</div>
    </div>
  );
}

export function TableWrap({
  minWidth,
  children,
}: {
  minWidth?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="tbl-wrap">
      <table className="tbl" style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
    </div>
  );
}

export function Note({
  kind = 'info',
  icon,
  children,
  style,
}: {
  kind?: 'info' | 'warn' | 'danger' | 'ok';
  icon: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`note ${kind}`} style={style}>
      <span className="ic">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

export function Search({ placeholder, defaultValue, maxWidth }: { placeholder?: string; defaultValue?: string; maxWidth?: number }) {
  return (
    <div className="search" style={maxWidth ? { maxWidth } : undefined}>
      <span className="mag">🔍</span>
      <input placeholder={placeholder} defaultValue={defaultValue} />
    </div>
  );
}

export function Select({ options, style }: { options: string[]; style?: React.CSSProperties }) {
  return (
    <select className="select" style={style}>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}
