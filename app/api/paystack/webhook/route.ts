import { NextResponse } from 'next/server';
import { confirmTransaction } from '@/lib/confirm';
import { isValidSignature, type PaystackTransaction } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

// Paystack calls this for every transaction event. It is the source of truth:
// even if the Builder closes the tab before returning, the payment is recorded.
// Set the URL in Paystack: Settings > API Keys & Webhooks > Webhook URL
//   https://<your-domain>/api/paystack/webhook
export async function POST(req: Request) {
  const raw = await req.text();
  if (!isValidSignature(raw, req.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let event: { event: string; data: PaystackTransaction };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }

  if (event.event === 'charge.success' && event.data?.reference?.startsWith('SIX-')) {
    try {
      await confirmTransaction(event.data);
    } catch (e) {
      // Log and return 500 so Paystack retries (e.g. a brief database outage).
      console.error('webhook confirm failed', e);
      return NextResponse.json({ error: 'retry' }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
