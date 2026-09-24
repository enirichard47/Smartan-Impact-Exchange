import { env, CAMPAIGN } from './env';
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

// Sends the Builder receipt through Resend. Returns false (without throwing)
// when email is not configured, so a missing key never blocks a payment.
export async function sendReceipt(r: Receipt): Promise<boolean> {
  if (!env.resendKey || !env.receiptFrom) return false;
  const card = `${env.siteUrl}/builder/${r.builderNumber}`;
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
        <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#5c6571">Impact Units are campaign contribution units. They are not shares, securities or investment products, and carry no ownership, dividends, returns or resale value.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.receiptFrom,
      to: [r.email],
      subject: `Your Builder receipt: ${rn || builderId(r.builderNumber)}`,
      html,
    }),
  });
  return res.ok;
}
