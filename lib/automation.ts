import { db } from './db';
import { checkEmailService } from './email';
import { env, hasDatabase, hasEmail } from './env';
import { sendUnsentReceipts, unsentCount } from './receipts';
import { reconcilePending } from './reconcile';
import { report } from './report';

export type DailyRun = {
  at: string;             // when it ran (ISO)
  ok: boolean;            // everything worked
  trigger: 'schedule' | 'admin';
  database: boolean;      // Supabase answered (this also keeps a free project awake)
  email: string;          // what Brevo said
  payments?: number;      // pending payments found paid at Paystack and confirmed
  sent: number;           // receipts sent by this run
  waiting: number;        // receipts still waiting afterwards
};

// The once-a-day job (Vercel Cron, see vercel.json), also runnable from the admin.
//   1. a database query  - counts as activity, so a free Supabase project never pauses
//   2. a Brevo check-in  - sends nothing; keeps the API key in use (Brevo retires keys
//                          after 90 days unused) and confirms it still works
//   3. pending payments  - asks Paystack about checkouts still pending (no webhook here)
//   4. owed receipts     - sends receipts held back by the daily email limit or an error
// The result is saved, so the admin can see when it last ran and whether it worked.
export async function runDaily(trigger: DailyRun['trigger']): Promise<DailyRun> {
  const run: DailyRun = { at: new Date().toISOString(), ok: true, trigger, database: false, email: 'Email is not set up yet.', sent: 0, waiting: 0 };
  if (!hasDatabase()) return { ...run, ok: false };

  const { error: dbError } = await db().from('campaign_totals').select('builders').single();
  run.database = !dbError;
  if (dbError) {
    run.ok = false;
    await report('database', 'The daily check could not reach the database.', dbError);
    return run;
  }

  // first: confirm payments donors made but never came back from (their receipts go out below)
  try {
    const r = await reconcilePending(100);
    run.payments = r.confirmed;
    if (r.errors) run.ok = false;
  } catch (e) {
    run.ok = false;
    await report('payments', 'The daily check could not check pending payments with Paystack.', e);
  }

  if (hasEmail()) {
    const check = await checkEmailService();
    run.email = check.detail;
    if (!check.ok) { run.ok = false; await report('email', check.detail); }
    else {
      try {
        const r = await sendUnsentReceipts();
        run.sent = r.sent;
        run.waiting = r.waiting;
        if (r.errors) run.ok = false;
      } catch (e) {
        run.ok = false;
        await report('email', 'The daily run could not send waiting receipts.', e);
      }
    }
  } else {
    run.waiting = await unsentCount();
  }

  await db().from('settings').upsert([
    { key: 'last_daily_run', value: run },
    // scheduled runs are tracked on their own, so pressing the admin button can't hide a broken schedule
    ...(trigger === 'schedule' ? [{ key: 'last_scheduled_run', value: run }] : []),
  ]);
  return run;
}

export async function lastDailyRun(): Promise<DailyRun | null> {
  if (!hasDatabase()) return null;
  const { data } = await db().from('settings').select('value').eq('key', 'last_daily_run').maybeSingle();
  return (data?.value as DailyRun) || null;
}

// Is the automatic (Vercel Cron) check healthy? Used for the admin warnings.
export type ScheduleHealth = {
  deployed: boolean;          // running on Vercel (the schedule only exists there)
  secretSet: boolean;         // CRON_SECRET present; without it every scheduled call is refused
  last: DailyRun | null;      // the last run started by the schedule
  overdue: boolean;           // deployed, and no scheduled run in 36 hours
};
export async function scheduleHealth(): Promise<ScheduleHealth> {
  const deployed = process.env.VERCEL === '1';
  const secretSet = Boolean(env.cronSecret);
  let last: DailyRun | null = null;
  if (hasDatabase()) {
    const { data } = await db().from('settings').select('value').eq('key', 'last_scheduled_run').maybeSingle();
    last = (data?.value as DailyRun) || null;
  }
  const age = last ? Date.now() - new Date(last.at).getTime() : Infinity;
  return { deployed, secretSet, last, overdue: deployed && age > 36 * 3600e3 };
}
