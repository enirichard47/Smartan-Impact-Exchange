import type { ReactNode } from 'react';
import { LEGAL } from '@/lib/legal';

export type Section = { id: string; title: string; body: ReactNode };

// Shared layout for /terms and /privacy.
export function LegalPage({ kicker, title, intro, sections, other }: {
  kicker: string; title: string; intro: ReactNode; sections: Section[]; other: { href: string; label: string };
}) {
  return (
    <main className="legal">
      <header className="legal__top">
        <a className="bpage__brand" href="/" aria-label="Smartan Impact Exchange home">
          <img src="/assets/logo-mark.png" alt="" width={32} height={32} />
          <span>Smartan Impact Exchange</span>
        </a>
        <a className="legal__back" href="/">Back to the campaign</a>
      </header>

      <div className="legal__head">
        <p className="legal__kicker">{kicker}</p>
        <h1>{title}</h1>
        <p className="legal__meta">Effective {LEGAL.effective}</p>
        <div className="legal__intro">{intro}</div>
      </div>

      <div className="legal__layout">
        <nav className="legal__toc" aria-label="On this page">
          <p>On this page</p>
          <ol>{sections.map(s => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}</ol>
        </nav>
        <article className="legal__body">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id}>
              <h2><span>{String(i + 1).padStart(2, '0')}</span>{s.title}</h2>
              {s.body}
            </section>
          ))}
        </article>
      </div>

      <footer className="legal__foot">
        <span>
          {LEGAL.entity}{LEGAL.registration ? `, ${LEGAL.registration}` : ''}{LEGAL.address ? `, ${LEGAL.address}` : ''}
        </span>
        <span><a href={other.href}>{other.label}</a> <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></span>
      </footer>
    </main>
  );
}

export const Mail = () => <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>;
