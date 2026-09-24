import crypto from 'node:crypto';
import { env } from './env';

const API = 'https://api.paystack.co';

type PaystackResponse<T> = { status: boolean; message: string; data: T };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.paystackSecret}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => null)) as PaystackResponse<T> | null;
  if (!res.ok || !body?.status) throw new Error(body?.message || `Paystack request failed (${res.status})`);
  return body.data;
}

export function initializeTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}) {
  return call<{ authorization_url: string; access_code: string; reference: string }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: 'NGN',
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      channels: ['card', 'bank', 'ussd', 'bank_transfer'],
    }),
  });
}

export type PaystackTransaction = {
  id: number;
  status: 'success' | 'failed' | 'abandoned' | 'ongoing' | 'pending' | 'reversed' | string;
  reference: string;
  amount: number; // kobo
  currency: string;
  channel: string;
  paid_at: string | null;
};

export function verifyTransaction(reference: string) {
  return call<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

// Paystack signs each webhook with HMAC-SHA512 of the raw body using the secret key.
export function isValidSignature(rawBody: string, signature: string | null) {
  if (!signature || !env.paystackSecret) return false;
  const expected = crypto.createHmac('sha512', env.paystackSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function newReference() {
  return `SIX-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}
