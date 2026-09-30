import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasDatabase } from './env';

let client: SupabaseClient | null = null;

// Give up on a request after 10 s instead of hanging the page, and retry a read once:
// a slow or dropped connection to Supabase is usually gone a moment later.
const TIMEOUT_MS = 10_000;
async function patientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const read = !init?.method || init.method === 'GET' || init.method === 'HEAD';
  const attempt = () => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS) });
  try {
    return await attempt();
  } catch (e) {
    if (!read || init?.signal) throw e;   // never repeat a write
    await new Promise(r => setTimeout(r, 400));
    return attempt();
  }
}

// Service-role client: server only. It bypasses Row Level Security, which is
// why it must never be imported into anything that runs in the browser.
export function db(): SupabaseClient {
  if (!hasDatabase()) throw new Error('Database is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: patientFetch },
    });
  }
  return client;
}
