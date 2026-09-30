import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { CAMPAIGN, env, hasPayments } from '@/lib/env';
import { initializeTransaction, newReference } from '@/lib/paystack';
import { allowCheckout, clientIp } from '@/lib/rate-limit';
import { report } from '@/lib/report';

export const dynamic = 'force-dynamic';

const Order = z.object({
  units: z.coerce.number().int().min(1, 'The minimum is one brick (₦10,000).').max(CAMPAIGN.maxUnits),
  name: z.string().trim().min(2, 'Add your name for the receipt.').max(80),
  email: z.string().trim().toLowerCase().email('Add a valid email so we can send your receipt.').max(120),
  phone: z.string().trim().max(20).optional().default(''),
  city: z.string().trim().max(60).optional().default(''),
  display: z.enum(['name', 'anonymous']).default('name'),
  consent: z.literal(true, { message: 'Please confirm you understand this is a contribution, not an investment.' }),
});

// Creates a pending contribution and a Paystack transaction, then hands the
// browser the Paystack checkout URL. The amount is always computed here from
// the number of bricks; the browser never decides what gets charged.
export async function POST(req: Request) {
  if (!hasPayments()) return NextResponse.json({ error: 'Online payment is not available yet. Please check back shortly.' }, { status: 503 });

  const parsed = Order.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Please check your details.' }, { status: 400 });
  const o = parsed.data;

  // stop scripts (or a stuck button) from opening thousands of payments
  if (!(await allowCheckout(clientIp(req), o.email))) {
    return NextResponse.json(
      { error: 'Too many payment attempts in a short time. Please wait a minute, then try again.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const reference = newReference();
  const amountKobo = o.units * CAMPAIGN.unitPriceKobo;

  const { error } = await db().from('contributions').insert({
    reference,
    units: o.units,
    amount_kobo: amountKobo,
    email: o.email,
    name: o.name,
    phone: o.phone || null,
    city: o.city || null,
    display: o.display,
  });
  if (error) {
    await report('payments', 'A donor could not start a payment: the database did not save their checkout.', error);
    return NextResponse.json({ error: 'We could not start your payment. Please try again.' }, { status: 500 });
  }

  try {
    const tx = await initializeTransaction({
      email: o.email,
      amountKobo,
      reference,
      callbackUrl: `${env.siteUrl}/builder/confirm`,
      metadata: {
        campaign: CAMPAIGN.id,
        units: o.units,
        cancel_action: `${env.siteUrl}/?payment=cancelled`,
        custom_fields: [
          { display_name: 'Campaign', variable_name: 'campaign', value: CAMPAIGN.id },
          { display_name: 'Bricks', variable_name: 'bricks', value: String(o.units) },
        ],
      },
    });
    return NextResponse.json({ url: tx.authorization_url, reference });
  } catch (e) {
    await report('payments', 'A donor could not start a payment: Paystack did not respond. Check the Paystack key and dashboard.', e);
    await db().from('contributions').update({ status: 'failed' }).eq('reference', reference);
    return NextResponse.json({ error: 'Payment could not be started. Please try again in a moment.' }, { status: 502 });
  }
}
