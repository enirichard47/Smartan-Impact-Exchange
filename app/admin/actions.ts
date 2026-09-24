'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { endSession, parseNairaToKobo, passwordMatches, requireAdmin, startSession } from '@/lib/admin';
import { invalidateCampaign } from '@/lib/campaign';
import { db } from '@/lib/db';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const dateOrNull = (f: FormData, k: string) => str(f, k) || null;

async function done(section: string) {
  invalidateCampaign();
  revalidatePath('/admin');
  redirect(`/admin?view=${section}&saved=1`);
}
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
export async function addLedger(form: FormData) {
  await requireAdmin();
  const amount = parseNairaToKobo(form.get('amount'));
  if (!amount) throw new Error('Amount is required');
  await run(db().from('ledger_entries').insert({
    entry_date: str(form, 'date'), ref: str(form, 'ref').toUpperCase(), category: str(form, 'category'), detail: str(form, 'detail'),
    source_doc: str(form, 'source') || null, amount_kobo: amount,
  }));
  await done('ledger');
}
export async function deleteLedger(form: FormData) {
  await requireAdmin();
  await run(db().from('ledger_entries').delete().eq('id', str(form, 'id')));
  await done('ledger');
}

/* ---------- updates ---------- */
export async function addUpdate(form: FormData) {
  await requireAdmin();
  await run(db().from('campaign_updates').insert({ published_on: str(form, 'date'), title: str(form, 'title'), body: str(form, 'body') || null }));
  await done('updates');
}
export async function deleteUpdate(form: FormData) {
  await requireAdmin();
  await run(db().from('campaign_updates').delete().eq('id', str(form, 'id')));
  await done('updates');
}

/* ---------- milestones ---------- */
export async function saveMilestone(form: FormData) {
  await requireAdmin();
  const status = str(form, 'status');
  await run(db().from('milestones').update({
    label: str(form, 'label'), status, verified_on: status === 'complete' ? dateOrNull(form, 'verified_on') : null,
  }).eq('position', Number(str(form, 'position'))));
  await done('milestones');
}

/* ---------- budget ---------- */
export async function saveBudgetLine(form: FormData) {
  await requireAdmin();
  await run(db().from('budget_lines').update({
    label: str(form, 'label'), note: str(form, 'note') || null, amount_kobo: parseNairaToKobo(form.get('amount')),
  }).eq('key', str(form, 'key')));
  await done('budget');
}

/* ---------- impact index ---------- */
export async function saveIndex(form: FormData) {
  await requireAdmin();
  const raw = str(form, 'value');
  const value = raw === '' ? null : Math.max(0, Math.min(100, Number(raw)));
  await run(db().from('impact_index').update({
    label: str(form, 'label'), value, verified_on: value == null ? null : dateOrNull(form, 'verified_on'),
  }).eq('position', Number(str(form, 'position'))));
  await done('index');
}

/* ---------- allocated / spent ---------- */
export async function saveTotals(form: FormData) {
  await requireAdmin();
  await run(db().from('settings').upsert([
    { key: 'allocated_kobo', value: parseNairaToKobo(form.get('allocated')) },
    { key: 'spent_kobo', value: parseNairaToKobo(form.get('spent')) },
  ]));
  await done('totals');
}
