import { NextResponse } from 'next/server';
import { confirmTransaction } from '@/lib/confirm';
import { env, hasPayments } from '@/lib/env';
import { firstName, receiptNo } from '@/lib/format';
import { verifyTransaction } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

// Paystack sends the Builder back here after checkout (?reference=...).
// We verify with Paystack directly (never trust the query string), record the
// contribution, then show the Builder card on the landing page.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const reference = url.searchParams.get('reference') || url.searchParams.get('trxref');
  const back = (q: string) => NextResponse.redirect(`${env.siteUrl}/?${q}`, 303);
  if (!reference || !hasPayments()) return back('payment=unknown');

  try {
    const tx = await verifyTransaction(reference);
    const done = await confirmTransaction(tx);
    if (done) {
      const q = new URLSearchParams({
        receipt: '1',
        builder: String(done.builderNumber),
        units: String(done.units),
        name: firstName(done.name),
        ref: reference,
        rn: receiptNo(done.receiptNumber) || '',
      });
      return back(q.toString());
    }
    if (['ongoing', 'pending', 'processing', 'queued'].includes(tx.status)) {
      return back(`payment=pending&ref=${encodeURIComponent(reference)}`);
    }
    return back('payment=failed');
  } catch (e) {
    console.error('confirm redirect failed', e);
    // The webhook will still record a successful payment; tell the Builder to check their email.
    return back(`payment=pending&ref=${encodeURIComponent(reference)}`);
  }
}
