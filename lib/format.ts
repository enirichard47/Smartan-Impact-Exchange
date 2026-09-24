import { CAMPAIGN } from './env';

const nf = new Intl.NumberFormat('en-NG');

export const naira = (kobo: number) => `₦${nf.format(Math.round(kobo / 100))}`;
export const num = (n: number) => nf.format(n);
export const builderId = (n: number) => `#${String(n).padStart(6, '0')}`;
// 123 -> "SIX-2026-000123"; null before a payment is confirmed
export const receiptNo = (n: number | null | undefined) => (n ? `${CAMPAIGN.receiptPrefix}-${String(n).padStart(6, '0')}` : null);
export const plural = (n: number, word: string) => `${num(n)} ${word}${n === 1 ? '' : 's'}`;

// "Richard Omole" -> "Richard O." for public display
export function displayName(full: string | null | undefined) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

export const firstName = (full: string | null | undefined) => String(full || '').trim().split(/\s+/)[0] || '';

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function watDate(iso: string | Date) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', day: '2-digit', month: 'numeric', year: 'numeric' }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  return `${get('day')} ${MON[Number(get('month')) - 1]} ${get('year')}`;
}
// "SEP 2026"
export const watMonth = (iso: string | Date) => watDate(iso).slice(3);

export function watTime(iso: string | Date) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}
