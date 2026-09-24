import { db } from './db';
import { sendReceipt } from './email';
import type { PaystackTransaction } from './paystack';
import { invalidateBuilder } from './builders';
import { invalidateCampaign } from './campaign';

export type Confirmed = {
  builderNumber: number;
  receiptNumber: number | null;
  units: number;
  amountKobo: number;
  name: string;
  email: string;
  totalUnits: number;
  newlyConfirmed: boolean;
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
      const sent = await sendReceipt({
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
      if (sent) await db().from('contributions').update({ receipt_sent_at: new Date().toISOString() }).eq('reference', tx.reference);
    } catch (e) {
      console.error('receipt email failed', e); // never fail a confirmed payment over email
    }
  }
  return result;
}
