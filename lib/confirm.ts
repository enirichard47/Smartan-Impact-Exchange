import { db } from './db';
import { sendReceiptNow } from './receipts';
import type { PaystackTransaction } from './paystack';
import { invalidateBuilder } from './builders';
import { invalidateCampaign } from './campaign';
import { report } from './report';

export type Confirmed = {
  builderNumber: number;
  receiptNumber: number | null;
  units: number;
  amountKobo: number;
  name: string;
  email: string;
  totalUnits: number;
  newlyConfirmed: boolean;
  // what happened to the receipt email: sent now, waiting for the daily run, or email is off
  receiptMail?: 'sent' | 'quota' | 'error' | 'off';
};

// Records a successful Paystack transaction. Safe to call more than once for
// the same reference (webhook + redirect): the database confirms it once and
// the receipt is only emailed the first time.
export async function confirmTransaction(tx: PaystackTransaction): Promise<Confirmed | null> {
  if (tx.status !== 'success') {
    if (['failed', 'abandoned', 'reversed'].includes(tx.status)) {
      await db().from('contributions').update({ status: 'failed' }).eq('reference', tx.reference).eq('status', 'pending');
    }
    return null;
  }

  const { data, error } = await db().rpc('confirm_contribution', {
    p_reference: tx.reference,
    p_amount_kobo: tx.amount,
    p_currency: tx.currency,
    p_paystack_id: tx.id,
    p_channel: tx.channel,
    p_paid_at: tx.paid_at,
  });
  if (error) throw new Error(`confirm_contribution failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  const result: Confirmed = {
    builderNumber: row.builder_number,
    receiptNumber: row.receipt_number ?? null,
    units: row.units,
    amountKobo: Number(row.amount_kobo),
    name: row.name,
    email: row.email,
    totalUnits: Number(row.total_units),
    newlyConfirmed: row.newly_confirmed,
  };

  if (result.newlyConfirmed) {
    // the public totals and this Builder's card have changed
    invalidateCampaign();
    invalidateBuilder(result.builderNumber);
    try {
      result.receiptMail = await sendReceiptNow({
        builderNumber: result.builderNumber,
        receiptNumber: result.receiptNumber,
        units: result.units,
        totalUnits: result.totalUnits,
        amountKobo: result.amountKobo,
        name: result.name,
        email: result.email,
        reference: tx.reference,
        paidAt: tx.paid_at || new Date().toISOString(),
      });
    } catch (e) {
      // never fail a confirmed payment over email; the daily run retries it
      result.receiptMail = 'error';
      await report('email', `The receipt email for Builder #${String(result.builderNumber).padStart(6, '0')} could not be sent. It will be retried automatically by the next daily run.`, e);
    }
  }
  return result;
}
