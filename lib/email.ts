import { env, CAMPAIGN, hasEmail } from './env';
import { builderId, firstName, naira, num, plural, receiptNo, watDate, watTime } from './format';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export type Receipt = {
  builderNumber: number;
  receiptNumber: number | null;
  units: number;
  totalUnits: number;
  amountKobo: number;
  name: string;
  email: string;
  reference: string;
  paidAt: string;
};

// What happened to one receipt email:
//   sent  - Brevo accepted it
//   off   - email is not set up (no BREVO_API_KEY / RECEIPT_FROM)
//   quota - Brevo's daily sending limit is used up; the daily job sends it tomorrow
//   error - anything else (the admin sees it in System alerts)
export type SendResult = { status: 'sent' | 'off' | 'quota' | 'error'; detail?: string };

// 'Smartan House <builders@smartanhouse.org>' -> { name, email }
function parseAddress(v: string) {
  const m = /^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/.exec(v);
  return m ? { name: m[1].replace(/^"|"$/g, '') || undefined, email: m[2] } : { email: v.trim() };
}

// Sends the Builder receipt through Brevo. Never throws, so email can never block a payment.
export async function sendReceipt(r: Receipt): Promise<SendResult> {
  if (!hasEmail()) return { status: 'off' };
  const card = `${env.siteUrl}/builder/${r.builderNumber}`;
  const cardImage = `${card}/opengraph-image`;
  const rn = receiptNo(r.receiptNumber);
  const rows: [string, string][] = [
    ...(rn ? [['Receipt number', rn] as [string, string]] : []),
    ['Builder ID', builderId(r.builderNumber)],
    ['Bricks laid', num(r.units)],
    ['Impact Units', num(r.units)],
    ['Contribution', naira(r.amountKobo)],
    ['Date', `${watDate(r.paidAt)}, ${watTime(r.paidAt)} WAT`],
    ['Paystack reference', r.reference],
    ['Campaign', CAMPAIGN.id],
  ];
  if (r.totalUnits > r.units) rows.splice(rn ? 3 : 2, 0, ['Your total bricks', num(r.totalUnits)]);

  const html = `<!doctype html><html><body style="margin:0;background:#f1f4f8;font-family:Helvetica,Arial,sans-serif;color:#0a0e14">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #dde3ea">
      <tr><td style="background:#07090d;color:#f5f7fa;padding:28px">
        <div style="font:500 11px/1 Menlo,Consolas,monospace;letter-spacing:2px;color:#8b949e">SMARTAN IMPACT EXCHANGE</div>
        <div style="font-size:30px;font-weight:600;margin-top:18px">I'm a Builder.</div>
        <div style="font:500 20px/1.3 Menlo,Consolas,monospace;color:#3fa2e8;margin-top:10px">BUILDER ${builderId(r.builderNumber)}</div>
        <div style="font:500 12px/1 Menlo,Consolas,monospace;letter-spacing:1px;margin-top:8px">${plural(r.units, 'BRICK').toUpperCase()} LAID</div>
      </td></tr>
      <tr><td style="padding:28px">
        <p style="margin:0 0 16px;font-size:16px">Thank you, ${esc(firstName(r.name))}. You're now part of building the new Smartan House facility.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e9ee;font-size:14px">
          ${rows.map(([k, v]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e9ee;color:#5c6571">${k}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #e5e9ee;font-family:Menlo,Consolas,monospace">${esc(v)}</td></tr>`).join('')}
        </table>
        <p style="margin:24px 0 0"><a href="${card}" style="display:inline-block;background:#0076c6;color:#ffffff;text-decoration:none;font-weight:600;font-size:13px;letter-spacing:1px;padding:14px 22px">VIEW AND SHARE YOUR BUILDER CARD</a></p>
        <p style="margin:12px 0 0;font-size:13px"><a href="${cardImage}" style="color:#0076c6">Download your Builder card as an image</a></p>
        <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#5c6571">Impact Units are campaign contribution units. They are not shares, securities or investment products, and carry no ownership, dividends, returns or resale value.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.brevoKey, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: parseAddress(env.receiptFrom),
        to: [{ email: r.email, name: r.name }],
        ...(env.replyTo ? { replyTo: parseAddress(env.replyTo) } : {}),
        subject: `Your Builder receipt: ${rn || builderId(r.builderNumber)}`,
        htmlContent: html,
        tags: ['receipt'],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { status: 'sent' };
    const body = await res.text().catch(() => '');
    // Brevo answers 402 (no credits left) or 429 (too many requests) when the daily
    // allowance is used up; either way the receipt simply waits for the next run
    if (res.status === 402 || res.status === 429 || /credit|quota|limit/i.test(body)) {
      return { status: 'quota', detail: `${res.status} ${body.slice(0, 200)}` };
    }
    return { status: 'error', detail: `${res.status} ${body.slice(0, 200)}` };
  } catch (e) {
    return { status: 'error', detail: e instanceof Error ? e.message : String(e) };
  }
}

// A small call that sends no email: it confirms the key still works and counts
// as activity, so Brevo never retires the key for being unused (90 days).
export async function checkEmailService(): Promise<{ ok: boolean; detail: string }> {
  if (!hasEmail()) return { ok: false, detail: 'Email is not set up (BREVO_API_KEY and RECEIPT_FROM).' };
  try {
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': env.brevoKey, accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true, detail: 'Brevo key works.' };
    return {
      ok: false,
      detail: res.status === 401
        ? 'Brevo rejected the API key (expired or revoked). Create a new key in Brevo and update BREVO_API_KEY.'
        : `Brevo answered ${res.status}.`,
    };
  } catch (e) {
    return { ok: false, detail: `Brevo did not respond: ${e instanceof Error ? e.message : String(e)}` };
  }
}
