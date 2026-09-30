import { NextResponse } from 'next/server';
import { getDirectory } from '@/lib/builders';
import { hasDatabase } from '@/lib/env';
import { report } from '@/lib/report';

export const dynamic = 'force-dynamic';

// GET /api/builders?q=&page=1&size=24: one page of the public Builder directory.
export async function GET(req: Request) {
  if (!hasDatabase()) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  const u = new URL(req.url);
  const q = (u.searchParams.get('q') || '').slice(0, 40);
  const page = Math.min(10_000, Math.max(1, Number(u.searchParams.get('page')) || 1));
  const size = Math.min(48, Math.max(6, Number(u.searchParams.get('size')) || 24));
  try {
    const data = await getDirectory(q, page, size);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } });
  } catch (e) {
    await report('database', 'The Builder directory on the public page could not load.', e);
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}
