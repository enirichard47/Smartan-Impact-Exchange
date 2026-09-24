'use client';

import type { ReactNode } from 'react';

// A submit button that asks before doing something irreversible.
export function ConfirmButton({ message, children, className = 'ad-btn ad-btn--danger ad-btn--sm' }: { message: string; children: ReactNode; className?: string }) {
  return (
    <button type="submit" className={className} onClick={e => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
