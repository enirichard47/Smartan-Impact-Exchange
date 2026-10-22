'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CLEAR_PHRASE, endSession, parseNairaToKobo, passwordMatches, requireAdmin, startSession } from '@/lib/admin';
import { invalidateAllBuilders } from '@/lib/builders';
import { invalidateCampaign } from '@/lib/campaign';
import { db } from '@/lib/db';
import { report } from '@/lib/report';
import { runDaily } from '@/lib/automation';
import { sendUnsentReceipts } from '@/lib/receipts';
import { reconcilePending } from '@/lib/reconcile';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const dateOrNull = (f: FormData, k: string) => str(f, k) || null;

/* Every admin form saves in place: no page reload (which flashed the page dark),
   just a short message under the form and fresh data. */
export type FormState = { ok: boolean; message: string; at: number } | null;
const reply = (ok: boolean, message: string): FormState => ({ ok, message, at: Date.now() });
// the public page and the admin pick up the change straight away
const saved = (message: string) => { invalidateCampaign(); revalidatePath('/admin'); return reply(true, message); };
const failed = (e: { message: string; code?: string } | null) =>
  reply(false, e?.code === '23505' ? 'Not saved: that reference is already used. Try another.' : `Not saved. The database said: ${e?.message || 'unknown error'}`);

async function run(q: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await q;
  if (error) throw new Error(error.message);
}

export async function login(form: FormData) {
  if (!passwordMatches(str(form, 'password'))) {
    await new Promise(r => setTimeout(r, 800)); // slow down guessing
    redirect('/admin?error=1');
  }
  await startSession();
  redirect('/admin');
}

export async function logout() {
  await endSession();
  redirect('/admin');
}

/* ---------- ledger ---------- */
export async function addLedger(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const amount = parseNairaToKobo(form.get('amount'));
  if (!amount) return reply(false, 'Not saved: enter an amount.');
  const { error } = await db().from('ledger_entries').insert({
    entry_date: str(form, 'date'), ref: str(form, 'ref').toUpperCase(), category: str(form, 'category'), detail: str(form, 'detail'),
    source_doc: str(form, 'source') || null, amount_kobo: amount,
  });
  return error ? failed(error) : saved('Entry added. It now shows in "Follow every naira" on the public page.');
}
export async function deleteLedger(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const { error } = await db().from('ledger_entries').delete().eq('id', str(form, 'id'));
  return error ? failed(error) : saved('Entry deleted.');
}

/* ---------- updates ---------- */
export async function addUpdate(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const { error } = await db().from('campaign_updates').insert({ published_on: str(form, 'date'), title: str(form, 'title'), body: str(form, 'body') || null });
  return error ? failed(error) : saved('Update published on the public page.');
}
export async function deleteUpdate(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const { error } = await db().from('campaign_updates').delete().eq('id', str(form, 'id'));
  return error ? failed(error) : saved('Update deleted.');
}

/* ---------- milestones ---------- */
export async function saveMilestone(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const status = str(form, 'status');
  const { error } = await db().from('milestones').update({
    label: str(form, 'label'), status, verified_on: status === 'complete' ? dateOrNull(form, 'verified_on') : null,
  }).eq('position', Number(str(form, 'position')));
  return error ? failed(error) : saved('Saved.');
}

/* ---------- budget ---------- */
export async function saveBudgetLine(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const { error } = await db().from('budget_lines').update({
    label: str(form, 'label'), note: str(form, 'note') || null, amount_kobo: parseNairaToKobo(form.get('amount')),
  }).eq('key', str(form, 'key'));
  return error ? failed(error) : saved('Saved.');
}

/* ---------- impact index ---------- */
export async function saveIndex(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const raw = str(form, 'value');
  const value = raw === '' ? null : Math.max(0, Math.min(100, Number(raw)));
  const { error } = await db().from('impact_index').update({
    label: str(form, 'label'), value, verified_on: value == null ? null : dateOrNull(form, 'verified_on'),
  }).eq('position', Number(str(form, 'position')));
  return error ? failed(error) : saved('Saved.');
}

/* ---------- Settings view ---------- */
async function raisedShown() {
  const [t, o] = await Promise.all([
    db().from('campaign_totals').select('raised_kobo').single(),
    db().from('settings').select('value').eq('key', 'opening_kobo').maybeSingle(),
  ]);
  return Number(t.data?.raised_kobo || 0) + (Number(o.data?.value) || 0);
}
const nairaText = (kobo: number) => `₦${new Intl.NumberFormat('en-NG').format(Math.round(kobo / 100))}`;

export async function saveTotals(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const { error } = await db().from('settings').upsert([
    { key: 'allocated_kobo', value: parseNairaToKobo(form.get('allocated')) },
    { key: 'spent_kobo', value: parseNairaToKobo(form.get('spent')) },
  ]);
  if (error) return reply(false, `Not saved. The database said: ${error.message}`);
  revalidatePath('/admin');
  return reply(true, 'Saved.');
}

// campaign starting amount (added to the public "raised" total)
export async function saveOpening(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const { error } = await db().from('settings').upsert({ key: 'opening_kobo', value: parseNairaToKobo(form.get('opening')) || 0 });
  if (error) return reply(false, `Not saved. The database said: ${error.message}`);
  invalidateCampaign();
  revalidatePath('/admin');
  return reply(true, `Saved. The public page now shows ${nairaText(await raisedShown())} raised.`);
}

// clear every contribution and Builder
export async function clearAll(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  if (str(form, 'confirm') !== CLEAR_PHRASE) return reply(false, `Nothing was cleared. Type ${CLEAR_PHRASE} exactly to confirm.`);
  const { error } = await db().rpc('reset_campaign');
  if (error) {
    await report('admin', 'Clear everything failed. Nothing was deleted.', error);
    // PGRST202: the function is not in the database yet (supabase/schema.sql has not been re-run)
    return reply(false, error.code === 'PGRST202'
      ? 'Nothing was cleared. The database needs a one-time update first: in Supabase, open SQL Editor, paste the whole of supabase/schema.sql and click Run. Then try again.'
      : `Nothing was cleared. The database said: ${error.message}. If it mentions permissions or "owner", run the latest supabase/schema.sql in Supabase and try again.`);
  }
  invalidateAllBuilders();
  invalidateCampaign();
  revalidatePath('/admin');
  return reply(true, 'Done. All contributions and Builders were removed, and numbering starts again at #000001.');
}

/* ---------- emails and the daily check (Settings) ---------- */
export async function sendReceiptsNow(_: FormState): Promise<FormState> {
  await requireAdmin();
  try {
    const r = await sendUnsentReceipts();
    revalidatePath('/admin');
    if (r.off) return reply(false, 'Email is not set up yet. Add BREVO_API_KEY and RECEIPT_FROM, then try again.');
    if (!r.sent && !r.waiting) return reply(true, 'Nothing to send. Every receipt has already gone out.');
    const parts = [`Sent ${r.sent} receipt${r.sent === 1 ? '' : 's'}.`];
    if (r.quota) parts.push(`Brevo's daily limit was reached; ${r.waiting} will go out automatically tomorrow morning.`);
    else if (r.waiting) parts.push(`${r.waiting} could not be sent yet and will be retried automatically.`);
    return reply(!r.errors, parts.join(' '));
  } catch (e) {
    return reply(false, `Nothing was sent. The database said: ${e instanceof Error ? e.message : String(e)}. If it mentions a missing function, run the latest supabase/schema.sql.`);
  }
}

export async function checkPaymentsNow(_: FormState): Promise<FormState> {
  await requireAdmin();
  try {
    const r = await reconcilePending(100);
    revalidatePath('/admin');
    if (!r.checked) return reply(true, 'No pending payments to check.');
    const s = (n: number) => (n === 1 ? '' : 's');
    const parts = [`Checked ${r.checked} pending payment${s(r.checked)} with Paystack.`];
    parts.push(r.confirmed
      ? `${r.confirmed} had been paid and ${r.confirmed === 1 ? 'is' : 'are'} now confirmed, with receipts sent.`
      : 'None had been paid yet.');
    if (r.failed) parts.push(`${r.failed} abandoned checkout${s(r.failed)} closed as failed.`);
    if (r.stillPending) parts.push(`${r.stillPending} still pending; they are checked again automatically.`);
    if (r.errors) parts.push('Paystack could not be reached for some of them; see System alerts.');
    return reply(!r.errors, parts.join(' '));
  } catch (e) {
    return reply(false, `Could not check with Paystack: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function runDailyNow(_: FormState): Promise<FormState> {
  await requireAdmin();
  const run = await runDaily('admin');
  revalidatePath('/admin');
  return reply(run.ok, run.ok
    ? `Done. Database OK. ${run.email} Sent ${run.sent} waiting receipt${run.sent === 1 ? '' : 's'}; ${run.waiting} still waiting.`
    : `The check found a problem: ${!run.database ? 'the database did not answer.' : run.email} See System alerts on the Overview for details.`);
}
