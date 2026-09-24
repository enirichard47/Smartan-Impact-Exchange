// Server-side configuration. Values come from environment variables
// (see .env.example). Nothing here is ever sent to the browser.

export const CAMPAIGN = {
  id: 'SH-2026-001',
  targetKobo: 300_000_000 * 100, // ₦300,000,000
  unitPriceKobo: 10_000 * 100, // ₦10,000 = 1 Impact Unit = 1 brick (also the minimum)
  maxUnits: 30_000, // the whole target in one go
  receiptPrefix: 'SIX-2026', // receipt numbers read SIX-2026-000123
};

export const env = {
  // SITE_URL is server-only (no NEXT_PUBLIC_ prefix); the page receives it from the server.
  // On Vercel it falls back to the project's production domain if SITE_URL is not set.
  siteUrl: (
    process.env.SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
    || 'http://localhost:3000'
  ).replace(/\/$/, ''),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  paystackSecret: process.env.PAYSTACK_SECRET_KEY || '',
  resendKey: process.env.RESEND_API_KEY || '',
  receiptFrom: process.env.RECEIPT_FROM || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminSecret: process.env.ADMIN_SESSION_SECRET || '',
};

export const hasDatabase = () => Boolean(env.supabaseUrl && env.supabaseServiceKey);
export const hasPayments = () => Boolean(env.paystackSecret) && hasDatabase();
