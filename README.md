# Smartan Impact Exchange

The fundraising site for the new Smartan House facility and the Acorn Incubator Hub. The target is **₦1,000,000,000**, raised **brick by brick**: every ₦10,000 is one brick (one Impact Unit), and one brick is also the minimum contribution.

Anyone can contribute in about a minute, without creating an account. They pay with card, bank transfer or USSD through Paystack, receive a numbered receipt by email, and get a Builder card to share. The page updates live as the total grows.

> Impact Units are campaign contributions. They are not shares, securities or investments, and carry no ownership, returns or resale value.

---

## Contents

1. [How it works](#how-it-works)
2. [Tech stack](#tech-stack)
3. [Getting started](#getting-started)
4. [Environment variables](#environment-variables)
5. [The admin area](#the-admin-area)
6. [Going live checklist](#going-live-checklist)
7. [Content and settings](#content-and-settings)
8. [Privacy and security](#privacy-and-security)
9. [Project structure](#project-structure)
10. [Troubleshooting](#troubleshooting)

---

## How it works

### A contribution, step by step

1. **Choose bricks.** The Builder picks how many bricks to lay, then enters their name and email (phone and city are optional). They also choose whether to appear by first name or anonymously.
2. **Checkout starts on the server.** `POST /api/checkout` calculates the amount itself (the browser's figure is never trusted), records a *pending* contribution and opens a Paystack transaction.
3. **The Builder pays on Paystack.** Card and bank details go to Paystack only; this site never sees them.
4. **The payment is confirmed twice over.**
   - Paystack sends the Builder back to `/builder/confirm`, and the server verifies the payment directly with Paystack.
   - Paystack also calls `POST /api/paystack/webhook`. This covers the case where the Builder closes the tab before returning.

   Whichever arrives first records the payment; the second does nothing. The database also rejects any payment whose amount doesn't match what was charged.
5. **The Builder is welcomed.**
   - They receive a **Builder number** (`#000001`, one per email address; later contributions add bricks to the same Builder).
   - They receive a **receipt number** (`SIX-2026-000001`, one per payment).
   - They see their **Builder card**, and receive an emailed receipt.
   - They get a shareable page at `/builder/<number>`, with its own preview image for WhatsApp and X.
6. **Everyone sees it.** Open copies of the page pick up the new total, the live feed and the Builder directory within about 20 seconds.

Builder and receipt numbers are only issued for confirmed payments, so failed or abandoned checkouts never leave gaps.

### What visitors see

| Section | What it shows |
|---|---|
| Opening sequence and Opening Bell | A launch-day intro, and the "ring the bell and lay a brick" call to action |
| Hero and live market board | The total raised, progress to ₦1B and bricks laid |
| The case, The Facility, The Build | Why the facility is needed, what it holds, and an illustration that builds as money comes in |
| Live campaign progress | Milestones, the Impact Index and the daily bricks chart |
| The Builders | A searchable directory with one card per Builder, newest first. Searchable by first name or Builder number, 24 at a time (12 on phones) |
| Transparency | The target, the amount raised, and the verified ledger entries |
| Become a Builder | How contributing works, and the Impact Unit card |

---

## Tech stack

| Part | Tool | Role |
|---|---|---|
| App and server | [Next.js 15](https://nextjs.org) (App Router, TypeScript 5.9) | API routes, the admin area, Builder pages and share images |
| Landing page | Plain HTML, CSS and JavaScript | `site/index.html` and `public/`, served by Next.js with live figures injected |
| Database | [Supabase](https://supabase.com) (Postgres) | Contributions, Builders and campaign content |
| Payments | [Paystack](https://paystack.com) | Card, bank transfer and USSD in naira |
| Email | [Brevo](https://www.brevo.com) | Receipt emails (optional; free plan: 300 a day) |
| Hosting | [Vercel](https://vercel.com) | Deployment and CDN |

---

## Getting started

**Requirements:** Node.js 20 or newer, plus accounts on Supabase and Paystack. Brevo is optional.

```bash
npm install
cp .env.example .env.local     # then fill it in (see below)
npm run dev                    # http://localhost:3000
```

### 1. Set up the database (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. From **Project Settings → API**, copy the **Project URL** and the **service_role** key into `.env.local`.

The script is safe to run again at any time. It only adds what is missing and never deletes data. **Run it again after pulling updates that change it** (for example, the receipt numbers and the admin's "clear all" button both needed new database pieces).

### 2. Set up payments (Paystack)

1. In the [Paystack dashboard](https://dashboard.paystack.com), open **Settings → API Keys & Webhooks**.
2. Copy the **Secret Key** into `PAYSTACK_SECRET_KEY`. Use the `sk_test_…` key until launch.
3. Set the **Webhook URL** to `https://YOUR-DOMAIN/api/paystack/webhook`.
4. To accept cards from abroad, turn on international payments in Paystack.

Until a Paystack key is set, the site still runs, but the pay button shows "Online payment opens soon".

### 3. Set up receipt emails (Brevo, optional)

1. Create an account at [brevo.com](https://www.brevo.com), then add and verify your sending domain (for example `smartanhouse.org`) under **Senders, domains & dedicated IPs**. A verified domain keeps receipts out of spam.
2. Create an API key under **SMTP & API → API keys** and set `BREVO_API_KEY`. `RECEIPT_FROM` must use the verified sender. Optionally set `RECEIPT_REPLY_TO` to an inbox someone reads.

The free plan sends **300 emails a day**. On busier days the extra receipts wait and are sent by the next morning's daily check (see [The daily check](#the-daily-check)). Without Brevo, payments still work; receipts simply aren't emailed, and the admin shows them as "Not sent".

### 4. Test a payment

With a `sk_test_…` key, use Paystack's test card:

| Card number | Expiry | CVV | OTP |
|---|---|---|---|
| `4084 0840 8408 4081` | any future date | `408` | `123456` |

To test the webhook on your own computer, expose it with a tunnel (for example `npx localtunnel --port 3000`) and use that address as the webhook URL in Paystack.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server at http://localhost:3000 |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run typecheck` | Check TypeScript types |

---

## Environment variables

Copy [`.env.example`](.env.example) to `.env.local`. **Never commit `.env.local`.** On Vercel, add the same variables under **Project → Settings → Environment Variables**, and mark the secret ones as *Sensitive*.

| Variable | Required | Secret | Description |
|---|---|---|---|
| `SITE_URL` | Yes | No | The public address, with no trailing slash (for example `https://smartanhouse.org`). Used for the Paystack return link, share links and receipts. On Vercel it falls back to the production domain if unset. |
| `SUPABASE_URL` | Yes | No | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Yes** | Supabase `service_role` key, used by the server only |
| `PAYSTACK_SECRET_KEY` | For payments | **Yes** | `sk_test_…` for testing, `sk_live_…` for launch |
| `BREVO_API_KEY` | For receipts | **Yes** | Brevo API key |
| `RECEIPT_REPLY_TO` | No | No | Where donors' replies go, e.g. `thesmartanhouse@gmail.com` |
| `CRON_SECRET` | For the daily check | **Yes** | Any long random value; Vercel sends it with each scheduled call |
| `RECEIPT_FROM` | For receipts | No | For example `Smartan House <builders@smartanhouse.org>` |
| `ADMIN_PASSWORD` | For admin | **Yes** | At least 10 characters |
| `ADMIN_SESSION_SECRET` | For admin | **Yes** | At least 32 random characters. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

None of these variables uses the `NEXT_PUBLIC_` prefix, so none of them is ever sent to the browser.

---

## The admin area

Go to **`/admin`** and sign in with `ADMIN_PASSWORD`. Changes appear on the public page within a few seconds.

| Section | What you can do |
|---|---|
| **Overview** | See the totals, the bricks-per-day chart, what needs attention (pending payments, failed payments, unsent receipts) and the latest Builders |
| **Contributions** | Browse confirmed, pending and failed payments. Search by name, email, receipt number or Paystack reference, and export to CSV for reconciliation |
| **Ledger** | Add or remove verified entries for "Follow every naira". The reference (`SIX-L-0001`, …) is filled in automatically, and you can attach the invoice or voucher number as the source document |
| **Updates** | Publish news for Builders |
| **Milestones** | Mark each build stage as upcoming, in progress or complete (verified) |
| **Budget** | The approved budget per line. **Private:** never shown publicly |
| **Impact Index** | Verified progress (0–100%) for each part of the project |
| **Settings** | The campaign starting amount, the private allocated and spent figures, and the danger zone |

### Campaign starting amount

Money raised before the site went live (pledges, events, bank transfers) can be entered in **Settings → Campaign starting amount**. It is added to the public "raised" total and to the bricks laid. It does not create Builders or appear in the Builder directory. Enter `0` to remove it.

### Clearing test data

**Settings → Danger zone → Clear everything** deletes every contribution and Builder, and restarts the numbering at `#000001` and `SIX-2026-000001`. Use it once, just before launch, to remove test payments.

- To confirm, you must type `CLEAR ALL`.
- The ledger, updates, milestones, budget and starting amount are kept.
- **This cannot be undone.** The payments remain in the Paystack dashboard.

---

## The daily check

Once a day at about 7:00 WAT, Vercel runs `/api/cron/daily` (scheduled in [`vercel.json`](vercel.json)). It:

1. **Queries the database**, so a free Supabase project never pauses for inactivity.
2. **Checks the Brevo key** without sending anything, so the key never expires from disuse (Brevo retires keys after 90 days unused) and a broken key is caught early.
3. **Sends receipts that are still owed**, oldest first: those held back by Brevo's daily limit or a temporary error.

Every receipt is claimed in the database before it is sent, so the live payment, the daily check and the admin button can never send the same receipt twice. Problems appear in **System alerts** on the admin Overview, and the Overview shows when the check last ran (an old date means it has stopped). Both actions can also be run by hand from **Settings → Emails and the daily check**.

On Vercel's free plan the check runs within about an hour of 7:00 WAT.

## Legal pages

The Terms of Contribution and Privacy Policy are written but **switched off** until the founder approves the final wording. They live in `app/_legal/`, a folder Next.js does not serve (any folder starting with `_` is private).

To bring them back:
1. Update the wording, and the details in `lib/legal.ts` (registered name, number, address, contact email).
2. Move `app/_legal/terms` to `app/terms`, `app/_legal/privacy` to `app/privacy`, and `app/_legal/legal-page.tsx` to `app/legal-page.tsx`.
3. Re-add the links: the footer, "How we use your details" on the details step, "I agree to the Terms of Contribution" on the payment checkbox, and the Builder page.

## Going live checklist

- [ ] Run the latest `supabase/schema.sql` in Supabase.
- [ ] Deploy to Vercel and connect the domain.
- [ ] Set every environment variable on Vercel. Set `SITE_URL` to the real domain.
- [ ] Complete Paystack's business verification, then switch to the `sk_live_…` key.
- [ ] Set the Paystack webhook URL to `https://YOUR-DOMAIN/api/paystack/webhook`.
- [ ] Verify the sending domain in Brevo and set `BREVO_API_KEY`.
- [ ] Set `CRON_SECRET` on Vercel, then check **Settings → Emails and the daily check** in the admin the next morning.
- [ ] Set a strong `ADMIN_PASSWORD` and a fresh `ADMIN_SESSION_SECRET` for production.
- [ ] Bring back the Terms and Privacy pages once the founder approves them (see [Legal pages](#legal-pages)).
- [ ] Make one real payment end to end on a phone, then **clear the test data** from the admin.
- [ ] Set the starting amount, if any.
- [ ] Confirm the launch date and the livestream link in `public/js/config.js`.

---

## Content and settings

Most content is edited in the admin. A few things live in files:

| What | Where |
|---|---|
| Target, brick price, receipt prefix | `lib/env.ts` (`CAMPAIGN`). The server passes these to the page, so change them here. |
| Launch date, opening bell time, city, livestream link, when the intro plays | `public/js/config.js` (`launch`) |
| Photos (captions and descriptions) | `public/js/config.js` (`photos`); image files go in `public/assets/photos/` (compressed WebP) |
| Facility zones and specifications | `public/js/config.js` (`facility`) |
| Legal details, contact email, refund window | `lib/legal.ts` |
| Terms and Privacy text (switched off for now) | `app/_legal/terms/page.tsx`, `app/_legal/privacy/page.tsx` |
| Page text and layout | `site/index.html`, `public/css/style.css`, `public/js/main.js` |

---

## Privacy and security

- **The database is sealed.** Row Level Security is on, with no public access. Only the server, using the `service_role` key, can read or write data.
- **Personal details stay private.** Emails, phone numbers, surnames and payment references never appear on the public site. Builders who chose to be anonymous show only their Builder number, and searching by name never finds them.
- **The budget is private.** The budget, the allocated total and the spent total are never sent to the browser.
- **Payments are verified on the server.** Every payment is checked with Paystack directly, and webhooks must carry a valid Paystack signature.
- **The admin sign-in is protected.** It uses a signed, HTTP-only cookie, and wrong passwords are slowed down.
- **Data is cached, not exposed.** Public figures are cached briefly and refreshed the moment a payment is confirmed or an admin saves. If Supabase is briefly unreachable, the last good figures are shown.

---

## Project structure

```
app/
  route.ts                         landing page: site/index.html + live figures
  api/campaign/route.ts            live figures, polled by the page every 20 s
  api/builders/route.ts            Builder directory: paging and search
  api/checkout/route.ts            starts a Paystack payment
  api/paystack/webhook/route.ts    Paystack events (signature checked)
  builder/confirm/route.ts         return from Paystack: verify, then show the Builder card
  builder/[number]/                public Builder page and its share image
  admin/                           admin area, server actions and CSV export
  terms/, privacy/                 legal pages
lib/
  campaign.ts                      live figures and caching
  builders.ts                      Builder pages and the public directory
  confirm.ts                       records a confirmed payment and sends the receipt
  paystack.ts, email.ts, db.ts     Paystack, Brevo and Supabase clients
  receipts.ts, automation.ts       receipt sending (claimed, never twice) and the daily check
  admin.ts, env.ts, format.ts      admin session, configuration, formatting
supabase/schema.sql                tables, numbering, totals, reset and security
site/index.html                    landing page markup
public/                            styles, scripts, images
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| The page shows ₦0 and the log says "live campaign load failed" | Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and that `schema.sql` has been run. |
| An admin action fails with "function … does not exist" | Run the latest `supabase/schema.sql` again. |
| Pay button says "Online payment opens soon" | `PAYSTACK_SECRET_KEY` is not set. |
| Payments work but no receipt arrives | Set `BREVO_API_KEY`, verify the sender in Brevo, and check **Settings → Emails and the daily check** in the admin (receipts waiting, last check). |
| Buttons stop working or pages show errors in development | The build cache is out of date. Stop the server, delete the `.next` folder and run `npm run dev` again. Never run `npm run build` while `npm run dev` is running. |
| A payment shows in Paystack but not on the site | Check that the webhook URL is correct and that the site is reachable from the internet. |
