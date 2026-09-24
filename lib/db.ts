import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, hasDatabase } from './env';

let client: SupabaseClient | null = null;

// Service-role client: server only. It bypasses Row Level Security, which is
// why it must never be imported into anything that runs in the browser.
export function db(): SupabaseClient {
  if (!hasDatabase()) throw new Error('Database is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      // fail fast instead of hanging the page if the database is unreachable
      global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(6000) }) },
    });
  }
  return client;
}
