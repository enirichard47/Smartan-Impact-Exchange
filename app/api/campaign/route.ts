import { after, NextResponse } from 'next/server';
import { getLiveCampaign } from '@/lib/campaign';
import { maybeReconcile } from '@/lib/reconcile';

export const dynamic = 'force-dynamic';

// Polled by the page every ~20s to keep figures, the feed and the wall live.
export async function GET() {
  const live = await getLiveCampaign();
  // after the response is sent: check payments still pending with Paystack
  // (at most every 5 minutes; this site has no Paystack webhook of its own)
  after(maybeReconcile);
  if (!live) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  return NextResponse.json(live, { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20' } });
}
