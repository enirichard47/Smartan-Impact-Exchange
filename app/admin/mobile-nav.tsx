'use client';

import { useRef, type ReactNode } from 'react';

type Item = { key: string; label: string; icon: string };

const Ico = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const MORE_ICON = 'M5 12h.01M12 12h.01M19 12h.01';

// Phones: a slim top bar and a bottom tab bar within thumb reach. The four
// most-used sections are tabs; the rest, plus sign-out, live in a "More" sheet.
export function MobileNav({ view, primary, more, signOut }: { view: string; primary: Item[]; more: Item[]; signOut: ReactNode }) {
  const sheet = useRef<HTMLDialogElement>(null);
  const inMore = more.some(m => m.key === view);
  const current = more.find(m => m.key === view);
  const close = () => sheet.current?.close();

  return (
    <>
      <header className="ad-mtop">
        <a className="ad-mtop__brand" href="/admin">
          <img src="/assets/logo-mark.png" alt="" width={28} height={26} />
          <span><b>Smartan House</b><small>Campaign admin</small></span>
        </a>
        <a className="ad-mtop__site" href="/" target="_blank" rel="noopener" aria-label="View public site">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></svg>
        </a>
      </header>

      <nav className="ad-tabs" aria-label="Admin">
        {primary.map(v => (
          <a key={v.key} href={`/admin?view=${v.key}`} className={v.key === view ? 'is-on' : ''} aria-current={v.key === view ? 'page' : undefined}>
            <Ico d={v.icon} /><span>{v.label}</span>
          </a>
        ))}
        <button type="button" className={inMore ? 'is-on' : ''} onClick={() => sheet.current?.showModal()} aria-haspopup="dialog">
          <Ico d={MORE_ICON} /><span>{current ? current.label : 'More'}</span>
        </button>
      </nav>

      <dialog ref={sheet} className="ad-sheet" aria-label="More sections" onClick={e => { if (e.target === sheet.current) close(); }}>
        <div className="ad-sheet__panel">
          <span className="ad-sheet__grip" aria-hidden="true" />
          <ul className="ad-sheet__list">
            {more.map(v => (
              <li key={v.key}>
                <a href={`/admin?view=${v.key}`} className={v.key === view ? 'is-on' : ''} aria-current={v.key === view ? 'page' : undefined}>
                  <Ico d={v.icon} /><span>{v.label}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="ad-sheet__foot">
            <a href="/" target="_blank" rel="noopener" className="ad-btn ad-btn--ghost ad-btn--block">View public site ↗</a>
            {signOut}
            <button type="button" className="ad-btn ad-btn--ghost ad-btn--block" onClick={close}>Close</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
