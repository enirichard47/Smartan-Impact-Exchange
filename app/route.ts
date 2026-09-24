import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getLiveCampaign, publicSettings } from '@/lib/campaign';
import { hasPayments } from '@/lib/env';

// The landing page. The design lives in site/index.html (plain HTML/CSS/JS
// served from /public); the server injects live campaign data so the first
// paint already shows real figures.
export const dynamic = 'force-dynamic';

let template: string | null = null;
async function getTemplate() {
  if (!template || process.env.NODE_ENV !== 'production') {
    template = await readFile(path.join(process.cwd(), 'site', 'index.html'), 'utf8');
  }
  return template;
}

const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

export async function GET() {
  const [html, live] = await Promise.all([getTemplate(), getLiveCampaign()]);
  const boot = `<script>(function(){var C=window.SIX_CONFIG;if(!C)return;Object.assign(C,${json(publicSettings())});`
    + `C.liveApi='/api/campaign';${hasPayments() ? "C.checkoutApi='/api/checkout';" : ''}`
    + `var L=${json(live)};if(L){Object.assign(C.campaign,L);}})();</script>`;

  const tag = '<script src="js/config.js"></script>';
  if (!html.includes(tag)) throw new Error('site/index.html is missing the js/config.js script tag');
  const out = html.replace(tag, `<script src="/js/config.js"></script>\n  ${boot}`);

  return new Response(out, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
    },
  });
}
