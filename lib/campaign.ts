import { revalidateTag, unstable_cache } from 'next/cache';
import { db } from './db';
import { CAMPAIGN, env, hasDatabase } from './env';
import { displayName } from './format';

// The shape the landing page reads (window.SIX_CONFIG.campaign). Amounts are
// in naira here because that is what the page script works in.
export type LiveCampaign = {
  raised: number;
  builders: number;
  updatedAt: string | null;
  allocated: number | null;
  spent: number | null;
  allocation: { key: string; label: string; note: string | null; amount: number | null }[];
  milestones: { label: string; status: string; verifiedOn: string | null }[];
  index: { label: string; value: number | null; verifiedOn: string | null }[];
  ledger: { date: string; ref: string; category: string; label?: string; detail: string; source: string | null; amount: number }[];
  updates: { date: string; title: string; body: string | null }[];
  daily: number[];
  recentBuilders: { key: string; id: number; name: string | null; city: string; units: number; ts: number }[];
};

const toNaira = (kobo: number | string | null | undefined) => (kobo == null ? null : Math.round(Number(kobo) / 100));

async function load(): Promise<LiveCampaign> {
  const d = db();
  const [totals, budget, milestones, index, ledger, updates, settings, daily, recent] = await Promise.all([
    d.from('campaign_totals').select('*').single(),
    d.from('budget_lines').select('*').order('position'),
    d.from('milestones').select('*').order('position'),
    d.from('impact_index').select('*').order('position'),
    d.from('ledger_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(50),
    d.from('campaign_updates').select('*').order('published_on', { ascending: false }).limit(12),
    d.from('settings').select('*'),
    d.rpc('daily_bricks', { p_days: 30 }),
    d.from('contributions')
      .select('reference, units, paid_at, builders!inner(number, name, city, display)')
      .eq('status', 'success')
      .order('paid_at', { ascending: false })
      .limit(24),
  ]);
  for (const r of [totals, budget, milestones, index, ledger, updates, settings, daily, recent]) {
    if (r.error) throw new Error(r.error.message);
  }

  const setting = (k: string) => (settings.data || []).find(s => s.key === k)?.value ?? null;
  const labelFor = (key: string) => (budget.data || []).find(b => b.key === key)?.label || key;
  const t = totals.data as { raised_kobo: number; builders: number; units: number; updated_at: string | null };

  return {
    raised: toNaira(t.raised_kobo) || 0,
    builders: t.builders || 0,
    updatedAt: t.updated_at,
    allocated: toNaira(setting('allocated_kobo')),
    spent: toNaira(setting('spent_kobo')),
    allocation: (budget.data || []).map(b => ({ key: b.key, label: b.label, note: b.note, amount: toNaira(b.amount_kobo) })),
    milestones: (milestones.data || []).map(m => ({ label: m.label, status: m.status, verifiedOn: m.verified_on })),
    index: (index.data || []).map(i => ({ label: i.label, value: i.value == null ? null : Number(i.value), verifiedOn: i.verified_on })),
    ledger: (ledger.data || []).map(l => ({
      date: l.entry_date, ref: l.ref, category: l.category, label: labelFor(l.category), detail: l.detail, source: l.source_doc || null, amount: toNaira(l.amount_kobo) || 0,
    })),
    updates: (updates.data || []).map(u => ({ date: u.published_on, title: u.title, body: u.body })),
    daily: (daily.data || []).map((r: { units: number }) => Number(r.units)),
    recentBuilders: (recent.data || []).map((c: any) => {
      const b = Array.isArray(c.builders) ? c.builders[0] : c.builders;
      const anon = b.display === 'anonymous';
      return {
        key: c.reference.slice(-10),                    // stable, not guessable back to a receipt
        id: b.number,
        name: anon ? null : displayName(b.name),
        city: anon ? '' : b.city || '',
        units: c.units,
        ts: new Date(c.paid_at).getTime(),
      };
    }),
  };
}

/* Caching, in two layers:
   1. Next's data cache, shared by every server instance (on Vercel, all regions).
      Tagged 'campaign' and cleared by invalidateCampaign() whenever the data
      changes (a payment is confirmed, an admin saves), so its lifetime can be
      long; REVALIDATE is only a safety net (e.g. the daily chart rolling over).
   2. A few seconds in memory per instance, so a burst of requests does not even
      reach the shared cache. The last good copy is also kept, so a Supabase
      outage or timeout serves slightly old figures instead of an error. */
const REVALIDATE = 300;
const MEMORY_TTL = 5_000;

const loadShared = unstable_cache(load, ['live-campaign'], { tags: ['campaign'], revalidate: REVALIDATE });

let memory: { at: number; data: LiveCampaign } | null = null;
let lastGood: LiveCampaign | null = null;
let inflight: Promise<LiveCampaign> | null = null;

export async function getLiveCampaign(): Promise<LiveCampaign | null> {
  if (!hasDatabase()) return null;
  if (memory && Date.now() - memory.at < MEMORY_TTL) return memory.data;
  if (!inflight) {
    inflight = loadShared()
      .then(data => { memory = { at: Date.now(), data }; lastGood = data; return data; })
      .finally(() => { inflight = null; });
  }
  try {
    return await inflight;
  } catch (e) {
    console.error('live campaign load failed', e);
    return lastGood;
  }
}

// Call after anything that changes what the public page shows.
export function invalidateCampaign() {
  memory = null;
  revalidateTag('campaign');
}

// What the server tells the page about itself (overrides js/config.js).
export const publicSettings = () => ({
  campaignId: CAMPAIGN.id,
  target: CAMPAIGN.targetKobo / 100,
  unitPrice: CAMPAIGN.unitPriceKobo / 100,
  siteUrl: env.siteUrl,
});
