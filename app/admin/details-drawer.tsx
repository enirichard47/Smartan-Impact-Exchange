'use client';

import { useEffect, useRef, useState } from 'react';
import { CopyButton } from './copy-button';

// A row's full details, set on the row as data-details='{"title":…,"rows":[[label, value, copyable]]}'
export type Details = { title: string; subtitle?: string; rows: [string, string, boolean?][] };

// One side panel for a whole table: clicking a row (or pressing Enter on it)
// that has data-details opens that row's full details, with copy buttons.
export function DetailsDrawer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [d, setD] = useState<Details | null>(null);

  useEffect(() => {
    const open = (row: HTMLElement) => {
      try { setD(JSON.parse(row.dataset.details || '')); } catch { return; }
      opener.current = row;
      dialog.current?.showModal();
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('a, button, input, select, textarea, form, dialog')) return;   // those keep their own job
      const row = t.closest<HTMLElement>('[data-details]');
      if (row) open(row);
    };
    const onKey = (e: KeyboardEvent) => {
      const row = (e.target as HTMLElement).closest?.<HTMLElement>('[data-details]');
      if (row && (e.key === 'Enter' || e.key === ' ') && e.target === row) { e.preventDefault(); open(row); }
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog} className="ad-drawer" aria-label={d ? `Details: ${d.title}` : 'Details'}
      onClose={() => opener.current?.focus()}
      onClick={e => { if (e.target === dialog.current) close(); }}
    >
      {d ? (
        <div className="ad-drawer__panel">
          <header className="ad-drawer__head">
            <div>
              <h2>{d.title}</h2>
              {d.subtitle ? <p>{d.subtitle}</p> : null}
            </div>
            <button type="button" className="ad-drawer__close" onClick={close} aria-label="Close details" autoFocus>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>
          <dl className="ad-drawer__list">
            {d.rows.map(([label, value, copy]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <span>{value || '-'}</span>
                  {copy && value && value !== '-' ? <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} /> : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </dialog>
  );
}
