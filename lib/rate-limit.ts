import crypto from 'node:crypto';
import { db } from './db';
import { env, hasDatabase } from './env';

// Limits on starting a payment. Generous on purpose: many Nigerian mobile users
// share one public IP address (carrier-grade NAT), so a strict per-IP limit
// would turn real donors away on a busy launch day.
export const CHECKOUT_LIMITS = {
  perIp: { limit: 20, windowSeconds: 60 },          // 20 attempts a minute from one network
  perEmail: { limit: 5, windowSeconds: 10 * 60 },   // 5 attempts in 10 minutes for one email
};

// IP addresses are stored hashed, never as-is.
const hash = (value: string) => crypto.createHmac('sha256', env.adminSecret || 'six').update(value).digest('hex').slice(0, 32);

export function clientIp(req: Request) {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : req.headers.get('x-real-ip') || '').trim() || 'unknown';
}

// Fallback when the database check is unavailable: a per-server count. It is
// less exact (each server counts on its own) but still stops a runaway script.
const local = new Map<string, { window: number; hits: number }>();
function hitLocal(key: string, limit: number, windowSeconds: number) {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const cur = local.get(key);
  const hits = cur && cur.window === window ? cur.hits + 1 : 1;
  local.set(key, { window, hits });
  if (local.size > 5000) local.clear();   // never grows without bound
  return hits <= limit;
}

async function hit(key: string, limit: number, windowSeconds: number) {
  if (hasDatabase()) {
    const { data, error } = await db().rpc('hit_rate_limit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
    if (!error) return data === true;
    // e.g. schema.sql not re-run yet: fall through to the per-server count
  }
  return hitLocal(key, limit, windowSeconds);
}

// true = go ahead; false = too many attempts right now
export async function allowCheckout(ip: string, email: string) {
  const { perIp, perEmail } = CHECKOUT_LIMITS;
  const [byIp, byEmail] = await Promise.all([
    hit(`checkout:ip:${hash(ip)}`, perIp.limit, perIp.windowSeconds),
    hit(`checkout:email:${hash(email.toLowerCase())}`, perEmail.limit, perEmail.windowSeconds),
  ]);
  return byIp && byEmail;
}
