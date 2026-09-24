import { revalidateTag, unstable_cache } from 'next/cache';
import { cache } from 'react';
import { db } from './db';
import { hasDatabase } from './env';
import { displayName } from './format';

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
    return await unstable_cache(() => fetchBuilder(number), ['builder', String(number)], { tags: [tagFor(number)], revalidate: 3600 })();
  } catch (e) {
    console.error('builder load failed', e);
    return null;
  }
});

export const invalidateBuilder = (number: number) => revalidateTag(tagFor(number));
