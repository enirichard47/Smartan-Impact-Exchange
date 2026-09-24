import type { ReactNode } from 'react';
import { logout } from './actions';

export const VIEWS = [
  { key: 'overview', label: 'Overview', icon: 'M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z' },
  { key: 'contributions', label: 'Contributions', icon: 'M4 6h16M4 12h16M4 18h10' },
  { key: 'ledger', label: 'Ledger', icon: 'M5 4h11l3 3v13H5zM9 9h6M9 13h6M9 17h4' },
  { key: 'updates', label: 'Updates', icon: 'M4 10v4l12 5V5L4 10zM16 9a3 3 0 010 6' },
  { key: 'milestones', label: 'Milestones', icon: 'M5 21V4M5 4h11l-2 4 2 4H5' },
  { key: 'budget', label: 'Budget', icon: 'M12 3v9l7.8 4.5A9 9 0 1112 3z' },
  { key: 'index', label: 'Impact Index', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { key: 'totals', label: 'Allocated & spent', icon: 'M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2' },
] as const;
export type View = (typeof VIEWS)[number]['key'];

export const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

export function Shell({ view, title, sub, actions, saved, warn, children }: {
  view: View; title: string; sub?: string; actions?: ReactNode; saved?: boolean; warn?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="ad">
      <aside className="ad-side">
        <a className="ad-brand" href="/admin">
          <img src="/assets/logo-mark.png" alt="" width={28} height={26} />
          <span><b>Smartan House</b><small>Campaign admin</small></span>
        </a>
        <nav className="ad-nav" aria-label="Admin">
          {VIEWS.map(v => (
            <a key={v.key} href={`/admin?view=${v.key}`} className={v.key === view ? 'is-on' : ''} aria-current={v.key === view ? 'page' : undefined}>
              <Icon d={v.icon} />{v.label}
            </a>
          ))}
        </nav>
        <div className="ad-side__foot">
          <a className="ad-link" href="/" target="_blank" rel="noopener">View public site ↗</a>
          <form action={logout}><button className="ad-link" type="submit">Sign out</button></form>
        </div>
      </aside>

      <main className="ad-main">
        <header className="ad-top">
          <div>
            <h1>{title}</h1>
            {sub ? <p>{sub}</p> : null}
          </div>
          {actions ? <div className="ad-top__actions">{actions}</div> : null}
        </header>
        {warn ? <div className="ad-banner">{warn}</div> : null}
        {children}
      </main>
      {saved ? <div className="ad-toast" role="status">Saved. The public page updates within a few seconds.</div> : null}
    </div>
  );
}

export const Card = ({ title, meta, children, flush }: { title?: string; meta?: ReactNode; children: ReactNode; flush?: boolean }) => (
  <section className={`ad-card${flush ? ' ad-card--flush' : ''}`}>
    {title ? <header className="ad-card__head"><h2>{title}</h2>{meta ? <div className="ad-card__meta">{meta}</div> : null}</header> : null}
    {children}
  </section>
);

export const Kpi = ({ label, value, sub, progress }: { label: string; value: string; sub?: string; progress?: number }) => (
  <div className="ad-kpi">
    <span className="ad-kpi__label">{label}</span>
    <b className="ad-kpi__value">{value}</b>
    {progress != null ? <i className="ad-kpi__bar"><i style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></i> : null}
    {sub ? <span className="ad-kpi__sub">{sub}</span> : null}
  </div>
);

export const Pill = ({ tone, children }: { tone: 'success' | 'pending' | 'failed' | 'neutral' | 'accent'; children: ReactNode }) => (
  <span className={`ad-pill ad-pill--${tone}`}>{children}</span>
);

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="ad-empty"><b>{title}</b>{children ? <p>{children}</p> : null}</div>;
}

// 30-day bars, server-rendered SVG with accessible values.
export function DailyBars({ days }: { days: { day: string; units: number }[] }) {
  const max = Math.max(1, ...days.map(d => d.units));
  const w = 100 / Math.max(1, days.length);
  return (
    <div className="ad-bars">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Bricks laid per day, last 30 days">
        {days.map((d, i) => {
          const h = (d.units / max) * 38;
          return <rect key={d.day} x={i * w + w * 0.14} y={40 - Math.max(h, d.units ? 0.8 : 0.25)} width={w * 0.72} height={Math.max(h, d.units ? 0.8 : 0.25)} className={i === days.length - 1 ? 'is-today' : ''}><title>{`${d.day}: ${d.units} bricks`}</title></rect>;
        })}
      </svg>
      <div className="ad-bars__axis"><span>{days[0]?.day.slice(5)}</span><span>Today</span></div>
    </div>
  );
}
