import { isAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { receiptNo } from '@/lib/format';

export const dynamic = 'force-dynamic';

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// CSV of contributions for accounting / reconciliation with Paystack.
export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response('Not signed in', { status: 401 });
  const status = new URL(req.url).searchParams.get('status') || 'success';
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from('contributions')
      .select('reference, receipt_number, status, units, amount_kobo, name, email, phone, city, display, paid_at, created_at, channel, receipt_sent_at, builders(number)')
      .eq('status', status).order('created_at').range(from, from + 999);
    if (error) return new Response(error.message, { status: 500 });
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const header = ['receipt_number', 'builder_number', 'paystack_reference', 'status', 'bricks', 'amount_naira', 'name', 'email', 'phone', 'city', 'display', 'channel', 'paid_at', 'created_at', 'receipt_sent_at'];
  const lines = rows.map(r => {
    const b = Array.isArray(r.builders) ? r.builders[0] : r.builders;
    return [receiptNo(r.receipt_number) ?? '', b?.number ?? '', r.reference, r.status, r.units, r.amount_kobo / 100, r.name, r.email, r.phone, r.city, r.display, r.channel, r.paid_at, r.created_at, r.receipt_sent_at].map(cell).join(',');
  });
  return new Response([header.join(','), ...lines].join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="six-contributions-${status}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
