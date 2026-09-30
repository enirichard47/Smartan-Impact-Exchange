'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

// A submit button that shows it is working while its form is being saved.
export function SubmitButton({ children, pending = 'Saving…', className = 'ad-btn ad-btn--primary' }: { children: ReactNode; pending?: string; className?: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={busy} aria-busy={busy}>
      {busy ? <><span className="ad-spin" aria-hidden="true" />{pending}</> : children}
    </button>
  );
}
