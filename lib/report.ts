import { db } from './db';
import { hasDatabase } from './env';

export type AlertSource = 'payments' | 'email' | 'database' | 'admin';

const describe = (e: unknown) =>
  e instanceof Error ? e.message
  : e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message)
  : e == null ? '' : String(e);

// the same problem is recorded at most once every 5 minutes per server, so an
// outage does not fill the log with thousands of identical alerts
const recent = new Map<string, number>();
const QUIET_MS = 5 * 60 * 1000;

// Records a problem for the admin's "System alerts" (admin Overview), in plain words.
// In production it also goes to the server log (Vercel > Logs) for debugging.
// Never throws: reporting a problem must not cause another one.
export async function report(source: AlertSource, message: string, err?: unknown) {
  const detail = describe(err).slice(0, 500) || null;
  if (process.env.NODE_ENV === 'production') console.error(`[${source}] ${message}${detail ? ` (${detail})` : ''}`);
  const key = `${source}:${message}`;
  const last = recent.get(key) || 0;
  if (Date.now() - last < QUIET_MS) return;
  recent.set(key, Date.now());
  if (!hasDatabase()) return;
  try {
    await db().from('system_log').insert({ source, message, detail });
  } catch {
    /* the database itself is down; the production log above still has it */
  }
}
