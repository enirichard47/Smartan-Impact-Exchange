'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

// A submit button that asks in an on-page window (not the browser's pop-up)
// before doing something irreversible, then shows it is working.
export function ConfirmButton({ message, children, confirmLabel, pending = 'Working…', className = 'ad-btn ad-btn--danger ad-btn--sm' }: {
  message: string; children: ReactNode; confirmLabel?: string; pending?: string; className?: string;
}) {
  const { pending: busy } = useFormStatus();
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const approved = useRef(false);
  const [open, setOpen] = useState(false);

  const close = () => { dialog.current?.close(); setOpen(false); button.current?.focus(); };
  const confirm = () => {
    approved.current = true;
    dialog.current?.close();
    setOpen(false);
    button.current?.form?.requestSubmit(button.current);
  };

  return (
    <>
      <button
        ref={button} type="submit" className={className} disabled={busy} aria-busy={busy}
        onClick={e => {
          if (approved.current) { approved.current = false; return; }   // confirmed: let the form submit
          e.preventDefault();
          // the form's own checks (e.g. a required field) run first
          if (button.current?.form && !button.current.form.reportValidity()) return;
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        {busy ? <><span className="ad-spin" aria-hidden="true" />{pending}</> : children}
      </button>
      <dialog ref={dialog} className="ad-modal" aria-labelledby="ad-modal-title" onClose={() => setOpen(false)} onCancel={close}
        onClick={e => { if (e.target === dialog.current) close(); }}>
        {open ? (
          <div className="ad-modal__card">
            <div className="ad-modal__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.2v.1" /></svg>
            </div>
            <h2 id="ad-modal-title">Are you sure?</h2>
            <p>{message}</p>
            <div className="ad-modal__actions">
              <button type="button" className="ad-btn ad-btn--ghost" onClick={close} autoFocus>Cancel</button>
              <button type="button" className="ad-btn ad-btn--danger-solid" onClick={confirm}>{confirmLabel || children}</button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
