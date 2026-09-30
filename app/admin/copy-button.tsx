'use client';

import { useState } from 'react';

// A small button that copies a value (e.g. a Paystack reference) and says so.
export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button" className={`ad-copy${done ? ' is-done' : ''}`} aria-label={label} title={done ? 'Copied' : label}
      onClick={async e => {
        e.stopPropagation();   // don't also open the row's details
        try { await navigator.clipboard.writeText(value); } catch { /* clipboard unavailable */ }
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done
        ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>}
    </button>
  );
}
