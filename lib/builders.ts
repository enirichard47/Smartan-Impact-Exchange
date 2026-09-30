import { revalidateTag, unstable_cache } from 'next/cache';
import { cache } from 'react';
import { db } from './db';
import { hasDatabase } from './env';
import { displayName } from './format';
import { report } from './report';

export type PublicBuilder = {
  number: number;
  name: string | null; // null when the Builder chose to stay anonymous
  city: string | null;
  bricks: number;
  since: string;
};

// One query: the Builder with their confirmed contributions embedded.
// Throws on a database error so a failure is never cached as "not found".
async function fetchBuilder(number: number): Promise<PublicBuilder | null> {
  const { data: b, error } = await db()
    .from('builders')
    .select('number, name, city, display, created_at, contributions(units)')
    .eq('number', number)
    .eq('contributions.status', 'success')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!b) return null;
  const bricks = (b.contributions || []).reduce((s: number, r: { units: number }) => s + r.units, 0);
  if (!bricks) return null;
  const anon = b.display === 'anonymous';
  return { number: b.number, name: anon ? null : displayName(b.name), city: anon ? null : b.city, bricks, since: b.created_at };
}

const tagFor = (number: number) => `builder:${number}`;

// Public view of one Builder: never includes email, phone or amounts per payment.
// Cached across requests (cleared by invalidateBuilder when they contribute again) and
// deduplicated within a request, so the page, its metadata and its share image share one lookup.
export const getBuilder = cache(async (number: number): Promise<PublicBuilder | null> => {
  if (!hasDatabase() || !Number.isInteger(number) || number < 1) return null;
  try {
    return await unstable_cache(() => fetchBuilder(number), ['builder', String(number)], { tags: [tagFor(number), 'builders'], revalidate: 3600 })();
  } catch (e) {
    await report('database', `The page for Builder #${String(number).padStart(6, '0')} could not load from the database.`, e);
    return null;
  }
});

export const invalidateBuilder = (number: number) => revalidateTag(tagFor(number));

/* ---------- the public Builder directory (landing page, "The Builders") ---------- */
export type DirectoryBuilder = { id: number; name: string | null; city: string; bricks: number; ts: number };
export type DirectoryPage = { items: DirectoryBuilder[]; total: number; page: number; pages: number };

// Search is by Builder number (e.g. "#000123" or "123") or by first name.
// Name search only matches Builders who chose to be shown by name, and only on
// the first word typed, so a search can never reveal an anonymous Builder or a surname.
export function parseDirectoryQuery(raw: string): { number?: number; name?: string } {
  const q = raw.trim().slice(0, 40);
  const n = /^#?0*(\d{1,7})$/.exec(q);
  if (n) return { number: Number(n[1]) };
  const word = q.split(/\s+/)[0]?.replace(/[^\p{L}'-]/gu, '') || '';
  return word.length >= 2 ? { name: word } : {};
}

async function fetchDirectory(q: string, page: number, size: number): Promise<DirectoryPage> {
  const { number, name } = parseDirectoryQuery(q);
  if (q.trim() && !number && !name) return { items: [], total: 0, page: 1, pages: 1 };
  let query = db()
    .from('builders')
    .select('number, name, city, display, contributions!inner(units, paid_at)', { count: 'exact' })
    .eq('contributions.status', 'success');
  if (number) query = query.eq('number', number);
  if (name) query = query.eq('display', 'name').ilike('name', `${name}%`);
  const { data, count, error } = await query.order('number', { ascending: false }).range((page - 1) * size, page * size - 1);
  // PGRST103: the page is past the end (e.g. after a reset); treat it as empty
  if (error && error.code !== 'PGRST103') throw new Error(error.message);
  const items = (error ? [] : data || []).map((b: any) => {
    const rows = (b.contributions || []) as { units: number; paid_at: string }[];
    const anon = b.display === 'anonymous';
    return {
      id: b.number,
      name: anon ? null : displayName(b.name),
      city: anon ? '' : b.city || '',
      bricks: rows.reduce((s, r) => s + r.units, 0),
      ts: Math.max(...rows.map(r => new Date(r.paid_at).getTime())),
    };
  });
  const total = count || 0;
  return { items, total, page, pages: Math.max(1, Math.ceil(total / size)) };
}

// Shares the 'campaign' tag, so it refreshes the moment a payment is confirmed.
export function getDirectory(q: string, page: number, size: number) {
  return unstable_cache(() => fetchDirectory(q, page, size), ['directory', q.trim().toLowerCase(), String(page), String(size)], { tags: ['campaign', 'builders'], revalidate: 300 })();
}

export const invalidateAllBuilders = () => revalidateTag('builders');
