import { NextResponse } from 'next/server';
import { maybeReconcile } from '@/lib/reconcile';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/payments/check: asks Paystack about payments still pending (donors who paid
// but closed the tab before returning). The Paystack account's webhook belongs to another
// system, so visitors' pages ping this quietly while the site is open. It runs at most
// once every 5 minutes across all servers; extra calls return at once. Safe for anyone
// to call: it only confirms payments Paystack itself reports as paid.
export async function POST() {
  const { ran, result } = await maybeReconcile();
  return NextResponse.json({ ran, confirmed: result?.confirmed ?? 0 }, { headers: { 'Cache-Control': 'no-store' } });
}
