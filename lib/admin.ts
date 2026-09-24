import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from './env';

// A simple signed-cookie session for the admin area: one shared password
// (ADMIN_PASSWORD), sessions signed with ADMIN_SESSION_SECRET, 12 hours long.
const COOKIE = 'six_admin';
const TTL_MS = 12 * 60 * 60 * 1000;

const sign = (payload: string) => crypto.createHmac('sha256', env.adminSecret).update(payload).digest('hex');

export const adminConfigured = () => env.adminPassword.length >= 10 && env.adminSecret.length >= 32;

export function passwordMatches(input: string) {
  if (!adminConfigured()) return false;
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(env.adminPassword).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function startSession() {
  const exp = String(Date.now() + TTL_MS);
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/admin', maxAge: TTL_MS / 1000,
  });
}

export async function endSession() {
  (await cookies()).delete({ name: COOKIE, path: '/admin' });
}

export async function isAdmin() {
  if (!adminConfigured()) return false;
  const raw = (await cookies()).get(COOKIE)?.value || '';
  const [exp, sig] = raw.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = sign(exp);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Not signed in');
}

// "₦1,250,000" / "1250000" / "" -> kobo (null when blank)
export function parseNairaToKobo(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').replace(/[₦,\s]/g, '');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid amount: ${v}`);
  return Math.round(n * 100);
}
