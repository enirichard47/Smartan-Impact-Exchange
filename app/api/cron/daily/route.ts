import { NextResponse } from 'next/server';
import { runDaily } from '@/lib/automation';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;   // sending a backlog of receipts can take a little while

// Called once a day by Vercel Cron (vercel.json). Vercel sends
// "Authorization: Bearer <CRON_SECRET>"; any other caller is refused.
export async function GET(req: Request) {
  if (!env.cronSecret || req.headers.get('authorization') !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: 'not allowed' }, { status: 401 });
  }
  const run = await runDaily('schedule');
  return NextResponse.json(run, { status: run.ok ? 200 : 500 });
}
