import { confirmTransaction } from './confirm';
import { db } from './db';
import { hasPayments } from './env';
import { verifyTransaction } from './paystack';
import { report } from './report';

// The Paystack account's only webhook belongs to another Smartan House system, so
// this site is not told when a payment succeeds. Instead it asks Paystack about
// payments still marked "pending" - donors who paid but closed the tab before
// Paystack sent them back. Confirming a payment is idempotent (confirm_contribution),
// and receipts are claimed before sending, so running this twice is harmless.

const MINUTE = 60_000;
const GRACE_MS = 2 * MINUTE;        // give a donor time to come back from Paystack normally
const FAIL_AFTER_MS = 24 * 60 * MINUTE;   // only call a checkout failed once it is a day old
const GIVE_UP_MS = 72 * 60 * MINUTE;      // after 3 days a pending checkout is closed as failed

export type Reconciled = { checked: number; confirmed: number; failed: number; stillPending: number; errors: number };

export async function reconcilePending(max = 20): Promise<Reconciled> {
  const out: Reconciled = { checked: 0, confirmed: 0, failed: 0, stillPending: 0, errors: 0 };
  if (!hasPayments()) return out;
  const now = Date.now();
  const { data, error } = await db().from('contributions')
    .select('reference, created_at')
    .eq('status', 'pending')
    .lte('created_at', new Date(now - GRACE_MS).toISOString())
    .order('created_at', { ascending: true })
    .limit(max);
  if (error) throw new Error(error.message);

  const markFailed = (reference: string) =>
    db().from('contributions').update({ status: 'failed' }).eq('reference', reference).eq('status', 'pending');

  for (const row of data || []) {
    out.checked++;
    const age = now - new Date(row.created_at).getTime();
    try {
      const tx = await verifyTransaction(row.reference);
      if (tx.status === 'success') {
        const done = await confirmTransaction(tx);   // records it, issues the Builder number, emails the receipt
        if (done) out.confirmed++;
      } else if ((['failed', 'abandoned', 'reversed'].includes(tx.status) && age > FAIL_AFTER_MS) || age > GIVE_UP_MS) {
        await markFailed(row.reference);
        out.failed++;
      } else {
        out.stillPending++;   // e.g. a bank transfer Paystack is still waiting on
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Paystack has no such transaction (e.g. a test-mode checkout looked up with a live key)
      if (/not found/i.test(msg)) {
        if (age > FAIL_AFTER_MS) { await markFailed(row.reference); out.failed++; } else out.stillPending++;
      } else {
        out.errors++;
        await report('payments', 'Pending payments could not be checked with Paystack. They will be checked again automatically.', e);
      }
    }
  }
  return out;
}

// At most once every 5 minutes across all servers (the time of the last check is kept in
// the database, so every server instance sees it). Called by /api/payments/check, which
// visitors' pages ping quietly while the site is open, so checks run whenever it has visitors.
const EVERY_MS = 5 * MINUTE;
export async function maybeReconcile(): Promise<{ ran: boolean; result?: Reconciled }> {
  if (!hasPayments()) return { ran: false };
  try {
    const { data } = await db().from('settings').select('value').eq('key', 'last_reconcile').maybeSingle();
    const last = Number(data?.value) || 0;
    if (Date.now() - last < EVERY_MS) return { ran: false };   // checked recently
    await db().from('settings').upsert({ key: 'last_reconcile', value: Date.now() });
    return { ran: true, result: await reconcilePending() };
  } catch (e) {
    await report('payments', 'The automatic check of pending payments failed. It will try again in a few minutes.', e);
    return { ran: false };
  }
}
