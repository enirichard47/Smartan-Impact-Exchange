import { db } from './db';
import { sendReceipt, type Receipt, type SendResult } from './email';
import { hasEmail } from './env';
import { report } from './report';

// Every receipt email goes through here. A receipt is claimed in the database
// first (claim_receipt / claim_unsent_receipts), so the live payment path, the
// daily job and the admin button can never send the same receipt twice.

const markSent = (reference: string) =>
  db().from('contributions').update({ receipt_sent_at: new Date().toISOString(), receipt_claimed_at: null }).eq('reference', reference);
// hand the receipt back so a later run can send it
const release = (references: string[]) =>
  references.length ? db().from('contributions').update({ receipt_claimed_at: null }).in('reference', references).is('receipt_sent_at', null) : null;

const quotaMessage = 'Brevo\'s daily email limit was reached. Remaining receipts will be sent automatically by tomorrow morning\'s run.';

// Live path: right after a payment is confirmed.
export async function sendReceiptNow(r: Receipt): Promise<SendResult['status']> {
  if (!hasEmail()) return 'off';
  const { data: claimed, error } = await db().rpc('claim_receipt', { p_reference: r.reference });
  // before schema.sql is re-run the function is missing: send without a claim, as before
  if (!error && claimed !== true) return 'sent';   // someone else already has it
  const res = await sendReceipt(r);
  if (res.status === 'sent') await markSent(r.reference);
  else {
    await release([r.reference]);
    if (res.status === 'quota') await report('email', quotaMessage, res.detail);
    if (res.status === 'error') await report('email', `The receipt for payment ${r.reference} could not be sent. It will be retried automatically by the next daily run.`, res.detail);
  }
  return res.status;
}

export type CatchUp = { sent: number; waiting: number; quota: boolean; errors: number; off: boolean };

// Daily job and admin button: send receipts that are still owed, oldest first.
export async function sendUnsentReceipts(max = 250): Promise<CatchUp> {
  if (!hasEmail()) return { sent: 0, waiting: await unsentCount(), quota: false, errors: 0, off: true };
  const { data, error } = await db().rpc('claim_unsent_receipts', { p_limit: max });
  if (error) throw new Error(error.message);
  const rows = (data || []) as { reference: string; receipt_number: number | null; builder_number: number; units: number; total_units: number; amount_kobo: number; name: string; email: string; paid_at: string }[];

  let sent = 0, errors = 0, quota = false, next = 0;
  const unsent: string[] = [];
  // five at a time: quick, and gentle on Brevo
  const worker = async () => {
    while (next < rows.length) {
      const row = rows[next++];
      if (quota) { unsent.push(row.reference); continue; }
      const res = await sendReceipt({
        builderNumber: row.builder_number, receiptNumber: row.receipt_number, units: row.units, totalUnits: Number(row.total_units),
        amountKobo: Number(row.amount_kobo), name: row.name, email: row.email, reference: row.reference, paidAt: row.paid_at,
      });
      if (res.status === 'sent') { sent++; await markSent(row.reference); continue; }
      unsent.push(row.reference);
      if (res.status === 'quota') quota = true; else errors++;
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  await release(unsent);

  const waiting = await unsentCount();
  if (quota) await report('email', `${quotaMessage} Receipts waiting: ${waiting}.`);
  if (errors) await report('email', `${errors} receipt email${errors === 1 ? '' : 's'} could not be sent and will be retried by the next run.`);
  if (waiting > 300) await report('email', `${waiting} receipts are waiting, more than one day of Brevo's free allowance (300). Consider a paid Brevo plan for this week.`);
  return { sent, waiting, quota, errors, off: false };
}

export async function unsentCount() {
  const { count } = await db().from('contributions').select('id', { count: 'exact', head: true }).eq('status', 'success').is('receipt_sent_at', null);
  return count || 0;
}
