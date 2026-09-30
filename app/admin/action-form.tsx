'use client';

import { useActionState, type ReactNode } from 'react';
import type { FormState } from './actions';

// A form that saves without reloading the page, then shows the result under it.
export function ActionForm({ action, className, children }: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <>
      <form action={formAction} className={className}>{children}</form>
      {state ? <p key={state.at} className={state.ok ? 'ad-ok' : 'ad-error'} role={state.ok ? 'status' : 'alert'}>{state.message}</p> : null}
    </>
  );
}
