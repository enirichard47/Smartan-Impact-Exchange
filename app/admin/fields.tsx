'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

/* ---------- Select: a styled listbox that submits like a native <select> ---------- */
type Option = { value: string; label: string };

export function Select({ name, options, defaultValue, required }: { name: string; options: Option[]; defaultValue?: string; required?: boolean }) {
  const [value, setValue] = useState(defaultValue ?? options[0]?.value ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    // the wrapping <label> counts as inside: a click on it already toggles the button
    const away = (e: PointerEvent) => {
      const scope = root.current?.closest('label') ?? root.current;
      if (!scope?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const show = () => { setActive(Math.max(0, options.findIndex(o => o.value === value))); setOpen(true); };
  const pick = (i: number) => { setValue(options[i].value); setOpen(false); button.current?.focus(); };

  const onKey = (e: KeyboardEvent) => {
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(last, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(last); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape' || e.key === 'Tab') setOpen(false);
    else if (e.key.length === 1) {
      const i = options.findIndex(o => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <div className="ad-select" ref={root} data-open={open || undefined}>
      <input type="hidden" name={name} value={value} required={required} />
      <button
        ref={button} type="button" className="ad-select__btn"
        aria-haspopup="listbox" aria-expanded={open} aria-controls={id}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={e => { e.preventDefault(); if (open) setOpen(false); else show(); }} onKeyDown={onKey}
      >
        <span>{current?.label ?? 'Select'}</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
      </button>
      {open && (
        <ul className="ad-select__list" role="listbox" id={id} ref={list}>
          {options.map((o, i) => (
            <li
              key={o.value} id={`${id}-${i}`} role="option" aria-selected={o.value === value}
              className={i === active ? 'is-active' : undefined}
              onPointerEnter={() => setActive(i)} onPointerDown={e => e.preventDefault()}
              // preventDefault stops the wrapping <label> from re-clicking the button and reopening the list
              onClick={e => { e.preventDefault(); pick(i); }}
            >
              <span>{o.label}</span>
              {o.value === value && <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- NumberField: input with − / + steppers (hold to repeat) ---------- */
export function NumberField({ name, defaultValue, min = 0, max = 100, step = 1, suffix, placeholder }: {
  name: string; defaultValue?: number | null; min?: number; max?: number; step?: number; suffix?: string; placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue == null ? '' : String(defaultValue));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(value);
  latest.current = value;

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const bump = (dir: 1 | -1) => {
    const n = latest.current === '' ? (dir > 0 ? min : max) : clamp(Number(latest.current) + dir * step);
    latest.current = String(n);
    setValue(latest.current);
  };
  const stop = () => clearTimeout(timer.current);
  const hold = (dir: 1 | -1) => {
    bump(dir);
    const again = (delay: number) => { timer.current = setTimeout(() => { bump(dir); again(Math.max(40, delay * 0.8)); }, delay); };
    again(380);
  };
  useEffect(() => stop, []);

  const n = value === '' ? null : Number(value);
  const stepper = (dir: 1 | -1, label: string, disabled: boolean) => (
    <button
      type="button" tabIndex={-1} aria-label={label} disabled={disabled}
      onPointerDown={e => { e.preventDefault(); hold(dir); }} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d={dir > 0 ? 'M8 3.5v9M3.5 8h9' : 'M3.5 8h9'} /></svg>
    </button>
  );

  return (
    <div className="ad-num">
      <div className="ad-num__field" onClick={e => e.currentTarget.querySelector('input')?.focus()}>
        <input
          style={{ width: value ? `${value.length + 0.4}ch` : '100%' }}
          name={name} type="text" inputMode="numeric" value={value} placeholder={placeholder}
          role="spinbutton" aria-valuemin={min} aria-valuemax={max} aria-valuenow={n ?? undefined}
          onChange={e => setValue(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={() => value !== '' && setValue(String(clamp(Number(value))))}
          onKeyDown={e => {
            if (e.key === 'ArrowUp') { e.preventDefault(); bump(1); }
            if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1); }
          }}
        />
        {suffix && value !== '' && <span>{suffix}</span>}
      </div>
      {stepper(-1, 'Decrease', n != null && n <= min)}
      {stepper(1, 'Increase', n != null && n >= max)}
    </div>
  );
}
