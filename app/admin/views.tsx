import { CLEAR_PHRASE } from '@/lib/admin';
import { db } from '@/lib/db';
import { CAMPAIGN, hasEmail } from '@/lib/env';
import { builderId, naira, num, receiptNo, watDate, watTime } from '@/lib/format';
import {
  addLedger, addUpdate, deleteLedger, deleteUpdate,
  checkPaymentsNow, clearAll, runDailyNow, saveBudgetLine, saveIndex, saveMilestone, saveOpening, saveTotals, sendReceiptsNow,
} from './actions';
import { lastDailyRun } from '@/lib/automation';
import { ConfirmButton } from './confirm-button';
import { CopyButton } from './copy-button';
import { DetailsDrawer, type Details } from './details-drawer';
import { SubmitButton } from './submit-button';
import { ActionForm } from './action-form';
import { NumberField, Select } from './fields';

const STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'complete', label: 'Complete (verified)' },
];
import { Card, DailyBars, Empty, Kpi, Pill } from './ui';

const koboToInput = (k: number | string | null) => (k == null ? '' : String(Math.round(Number(k) / 100)));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);
const when = (iso: string | null) => (iso ? `${watDate(iso)}, ${watTime(iso)}` : '-');

type Totals = { raised_kobo: number; builders: number; units: number; updated_at: string | null };
async function totals(): Promise<Totals> {
  const { data } = await db().from('campaign_totals').select('*').single();
  return (data as Totals) || { raised_kobo: 0, builders: 0, units: 0, updated_at: null };
}
// the campaign starting amount, in kobo (added to the public raised total)
async function openingKobo() {
  const { data } = await db().from('settings').select('value').eq('key', 'opening_kobo').maybeSingle();
  return Number(data?.value) || 0;
}
const count = async (build: (q: any) => any) => {
  const { count: c } = await build(db().from('contributions').select('id', { count: 'exact', head: true }));
  return c || 0;
};

// problems recorded by lib/report.ts; empty if the table is not set up yet
type Alert = { id: number; at: string; source: string; message: string; detail: string | null };
const ALERT_LABEL: Record<string, string> = { payments: 'Payments', email: 'Email', database: 'Database', admin: 'Admin' };
async function systemAlerts(): Promise<Alert[]> {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data, error } = await db().from('system_log').select('*').gte('at', since).order('at', { ascending: false }).limit(20);
  return error ? [] : (data as Alert[]) || [];
}

const unsentReceipts = () => count(q => q.eq('status', 'success').is('receipt_sent_at', null));

/* ============================ OVERVIEW ============================ */
export async function Overview() {
  const [t, pending, failed, unsent, daily, recent, milestones, opening, alerts, lastRun] = await Promise.all([
    totals(),
    count(q => q.eq('status', 'pending')),
    count(q => q.eq('status', 'failed')),
    count(q => q.eq('status', 'success').is('receipt_sent_at', null)),
    db().rpc('daily_bricks', { p_days: 30 }),
    db().from('contributions').select('reference, units, amount_kobo, name, city, paid_at, builders(number)').eq('status', 'success').order('paid_at', { ascending: false }).limit(8),
    db().from('milestones').select('*').order('position'),
    openingKobo(),
    systemAlerts(),
    lastDailyRun(),
  ]);
  const runAge = lastRun ? Date.now() - new Date(lastRun.at).getTime() : Infinity;
  const runStale = runAge > 36 * 3600e3;   // it runs every 24 h; 36 h without one means it stopped
  const raised = Number(t.raised_kobo) + opening;
  const raisedPct = pct(raised, CAMPAIGN.targetKobo);
  const days = ((daily.data || []) as { day: string; units: number }[]).map(d => ({ day: String(d.day), units: Number(d.units) }));
  const last30 = days.reduce((s, d) => s + d.units, 0);
  const ms = milestones.data || [];
  const done = ms.filter(m => m.status === 'complete').length;

  return (
    <>
      <div className="ad-kpis">
        <Kpi label="Raised" value={naira(raised)} sub={`${raisedPct.toFixed(2)}% of ${naira(CAMPAIGN.targetKobo)}${opening ? `, incl. ${naira(opening)} starting amount` : ''}`} progress={raisedPct} />
        <Kpi label="Builders" value={num(t.builders)} sub={t.updated_at ? `Last payment ${when(t.updated_at)}` : 'No payments yet'} />
        <Kpi label="Bricks laid" value={num(Number(t.units))} sub={`of ${num(CAMPAIGN.targetKobo / CAMPAIGN.unitPriceKobo)}`} progress={pct(Number(t.units), CAMPAIGN.targetKobo / CAMPAIGN.unitPriceKobo)} />
        <Kpi label="Average per Builder" value={t.builders ? naira(Number(t.raised_kobo) / t.builders) : '-'} sub={t.builders ? `${(Number(t.units) / t.builders).toFixed(1)} bricks` : undefined} />
      </div>

      <div className="ad-grid">
        <Card title="Bricks laid per day" meta={<span>{num(last30)} in the last 30 days</span>}>
          <DailyBars days={days} />
        </Card>
        <Card title="Needs attention">
          <ul className="ad-attn">
            <li><a href="/admin?view=contributions&status=pending"><span>Pending payments</span><b className={pending ? 'is-warn' : ''}>{num(pending)}</b></a></li>
            <li><a href="/admin?view=contributions&status=success&receipt=unsent"><span>Receipts not emailed</span><b className={unsent ? 'is-warn' : ''}>{num(unsent)}</b></a></li>
            <li><a href="/admin?view=contributions&status=failed"><span>Failed payments</span><b>{num(failed)}</b></a></li>
            <li><a href="/admin?view=milestones"><span>Milestones verified</span><b>{done} / {ms.length}</b></a></li>
            <li><a href="/admin?view=totals#automation"><span>Last automatic check</span><b className={runStale || (lastRun && !lastRun.ok) ? 'is-warn' : ''}>{lastRun ? when(lastRun.at) : 'Not run yet'}</b></a></li>
            <li><a href="#alerts"><span>System alerts (7 days)</span><b className={alerts.length ? 'is-warn' : ''}>{num(alerts.length)}</b></a></li>
          </ul>
        </Card>
      </div>

      <div id="alerts">
        <Card title="System alerts" meta={<span>Problems the site ran into in the last 7 days</span>} flush>
          {alerts.length ? (
            <ul className="ad-alerts">
              {alerts.map(a => (
                <li key={a.id}>
                  <Pill tone={a.source === 'payments' ? 'failed' : a.source === 'email' ? 'pending' : 'neutral'}>{ALERT_LABEL[a.source] || a.source}</Pill>
                  <div>
                    <p>{a.message}</p>
                    {a.detail ? <code>{a.detail}</code> : null}
                  </div>
                  <time className="dim nowrap">{when(a.at)}</time>
                </li>
              ))}
            </ul>
          ) : <Empty title="All clear.">No problems in the last 7 days. If a payment, receipt email or the database has trouble, it will show here.</Empty>}
        </Card>
      </div>

      <Card title="Latest Builders" meta={<a className="ad-link" href="/admin?view=contributions">View all →</a>} flush>
        {recent.data?.length ? (
          <table className="ad-table ad-table--cards">
            <thead><tr><th>Builder</th><th>Name</th><th>City</th><th className="r">Bricks</th><th className="r">Amount</th><th className="r">Paid</th></tr></thead>
            <tbody>
              {recent.data.map((c: any) => {
                const b = Array.isArray(c.builders) ? c.builders[0] : c.builders;
                return (
                  <tr key={c.reference}>
                    <td data-label="Builder" className="mono">{b ? builderId(b.number) : '-'}</td><td data-label="Name">{c.name}</td><td data-label="City" className="dim">{c.city || '-'}</td>
                    <td data-label="Bricks" className="r mono">{num(c.units)}</td><td data-label="Amount" className="r mono">{naira(c.amount_kobo)}</td><td data-label="Paid" className="r dim">{when(c.paid_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <Empty title="No Builders yet.">The first confirmed payment will appear here the moment Paystack confirms it.</Empty>}
      </Card>
    </>
  );
}

/* ========================== CONTRIBUTIONS ========================== */
const PAGE = 50;
// "SIX-MUO753Q0-D332FFDC46" -> "SIX-MUO75…FC46" (the full reference shows on hover and in the details)
const shortRef = (r: string) => (r.length > 16 ? `${r.slice(0, 9)}…${r.slice(-4)}` : r);
export async function Contributions({ status, q, page, receipt }: { status: string; q: string; page: number; receipt?: string }) {
  const safeQ = q.replace(/[^\p{L}\p{N}@.\-_ ]/gu, '').trim().slice(0, 60);
  const [cSuccess, cPending, cFailed] = await Promise.all([
    count(x => x.eq('status', 'success')), count(x => x.eq('status', 'pending')), count(x => x.eq('status', 'failed')),
  ]);
  let query = db().from('contributions')
    .select('reference, receipt_number, units, amount_kobo, name, email, phone, city, display, status, channel, paid_at, created_at, receipt_sent_at, builders(number)', { count: 'exact' })
    .eq('status', status);
  // "SIX-2026-000123", "000123" or "123" also finds that receipt number
  const rn = safeQ.match(/^(?:SIX-\d{4}-)?0*(\d{1,9})$/i)?.[1];
  if (safeQ) query = query.or(`name.ilike.%${safeQ}%,email.ilike.%${safeQ}%,reference.ilike.%${safeQ}%${rn ? `,receipt_number.eq.${rn}` : ''}`);
  if (receipt === 'unsent') query = query.is('receipt_sent_at', null);
  const { data, count: total } = await query
    .order(status === 'success' ? 'paid_at' : 'created_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  const pages = Math.max(1, Math.ceil((total || 0) / PAGE));
  const link = (p: Record<string, string | number>) => {
    const s = new URLSearchParams({ view: 'contributions', status, ...(safeQ ? { q: safeQ } : {}), ...(receipt ? { receipt } : {}) });
    Object.entries(p).forEach(([k, v]) => s.set(k, String(v)));
    return `/admin?${s}`;
  };
  const tabs: [string, string, number][] = [['success', 'Confirmed', cSuccess], ['pending', 'Pending', cPending], ['failed', 'Failed', cFailed]];

  return (
    <Card flush>
      <div className="ad-toolbar">
        <div className="ad-seg" role="tablist">
          {tabs.map(([k, label, n]) => (
            <a key={k} href={`/admin?view=contributions&status=${k}`} className={k === status ? 'is-on' : ''} role="tab" aria-selected={k === status}>
              {label}<span>{num(n)}</span>
            </a>
          ))}
        </div>
        <form className="ad-search" action="/admin" method="get">
          <input type="hidden" name="view" value="contributions" /><input type="hidden" name="status" value={status} />
          <input type="search" name="q" defaultValue={safeQ} placeholder="Search name, email, receipt no. or reference" aria-label="Search contributions" />
        </form>
      </div>
      {receipt === 'unsent' ? <div className="ad-filter">Showing only confirmed payments whose receipt was not emailed. <a className="ad-link" href={`/admin?view=contributions&status=${status}`}>Clear</a></div> : null}
      {data?.length ? (
        <div className="ad-scroll">
          <table className="ad-table ad-table--cards ad-table--rows">
            <thead><tr><th>Date</th><th>Donor</th><th>City</th><th className="r">Bricks and amount</th><th>Builder and receipt</th><th>Payment</th><th>Status</th></tr></thead>
            <tbody>
              {data.map((c: any) => {
                const b = Array.isArray(c.builders) ? c.builders[0] : c.builders;
                const at = c.paid_at || c.created_at;
                const rn = receiptNo(c.receipt_number);
                const state = c.status === 'success' ? (c.receipt_sent_at ? 'Confirmed, receipt emailed' : 'Confirmed, receipt not emailed yet') : c.status === 'pending' ? 'Pending' : 'Failed';
                const pill = c.status === 'success'
                  ? (c.receipt_sent_at ? <Pill tone="success">Emailed</Pill> : <Pill tone="pending">Not emailed</Pill>)
                  : c.status === 'pending' ? <Pill tone="pending">Pending</Pill> : <Pill tone="failed">Failed</Pill>;
                const details: Details = {
                  title: c.name,
                  subtitle: `${naira(c.amount_kobo)} for ${num(c.units)} brick${c.units === 1 ? '' : 's'}`,
                  rows: [
                    ['Date', when(at)], ['Status', state],
                    ['Name', c.name], ['Shown publicly', c.display === 'anonymous' ? 'Anonymous' : 'By first name and initial'],
                    ['Email', c.email, true], ['Phone', c.phone || '', true], ['City', c.city || ''],
                    ['Bricks', num(c.units)], ['Amount', naira(c.amount_kobo)],
                    ['Builder', b ? builderId(b.number) : '', true], ['Receipt number', rn || '', true],
                    ['Payment channel', c.channel || ''], ['Paystack reference', c.reference, true],
                  ],
                };
                return (
                  <tr key={c.reference} data-details={JSON.stringify(details)} tabIndex={0} aria-label={`${c.name}, ${naira(c.amount_kobo)}. Press Enter for details`}>
                    <td data-label="Date"><div className="ad-stack"><span>{watDate(at)}</span><span className="dim mono">{watTime(at)}</span></div></td>
                    <td data-label="Donor"><div className="ad-stack">
                      <b>{c.name}{c.display === 'anonymous' ? <Pill tone="neutral">Anonymous</Pill> : null}</b>
                      <span className="ad-break">{c.email}</span>
                      {c.phone ? <span className="dim mono">{c.phone}</span> : null}
                    </div></td>
                    <td data-label="City" className="dim">{c.city || '-'}</td>
                    <td data-label="Bricks and amount" className="r"><div className="ad-stack ad-stack--r">
                      <b className="mono">{num(c.units)} brick{c.units === 1 ? '' : 's'}</b>
                      <span className="mono dim">{naira(c.amount_kobo)}</span>
                    </div></td>
                    <td data-label="Builder and receipt"><div className="ad-stack">
                      <span className="mono">{b ? builderId(b.number) : '-'}</span>
                      <span className="mono dim">{rn || '-'}</span>
                    </div></td>
                    <td data-label="Payment"><div className="ad-stack">
                      <span>{c.channel ? c.channel.replace(/_/g, ' ') : '-'}</span>
                      <span className="ad-ref"><code title={c.reference}>{shortRef(c.reference)}</code><CopyButton value={c.reference} label="Copy Paystack reference" /></span>
                    </div></td>
                    <td data-label="Status">{pill}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <DetailsDrawer />
        </div>
      ) :<Empty title={safeQ ? 'No matches.' : 'Nothing here yet.'}>{safeQ ? 'Try a different name, email, receipt number or reference.' : 'Contributions appear here as soon as Builders start paying.'}</Empty>}
      <footer className="ad-pager">
        <span>{num(total || 0)} {total === 1 ? 'contribution' : 'contributions'}</span>
        <div>
          {page > 1 ? <a className="ad-btn ad-btn--ghost ad-btn--sm" href={link({ page: page - 1 })}>Previous</a> : null}
          <span className="dim">Page {page} of {pages}</span>
          {page < pages ? <a className="ad-btn ad-btn--ghost ad-btn--sm" href={link({ page: page + 1 })}>Next</a> : null}
        </div>
      </footer>
    </Card>
  );
}

/* ============================== LEDGER ============================= */
export async function Ledger() {
  const [ledger, budget] = await Promise.all([
    db().from('ledger_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(200),
    db().from('budget_lines').select('key, label').order('position'),
  ]);
  const cats = budget.data || [];
  const rows = ledger.data || [];
  const total = rows.reduce((s, l) => s + Number(l.amount_kobo), 0);
  // next number in the SIX-L-0001 sequence (admins can still type another)
  const lastRef = Math.max(0, ...rows.map(l => Number(/^SIX-L-(\d+)$/i.exec(l.ref)?.[1] || 0)));
  const nextRef = `SIX-L-${String(lastRef + 1).padStart(4, '0')}`;
  return (
    <>
      <Card title="Add a ledger entry" meta={<span>Appears publicly in "Follow every naira"</span>}>
        <form action={addLedger} className="ad-form ad-form--row">
          <label><span>Date</span><input type="date" name="date" defaultValue={today()} required /></label>
          <label><span>Reference</span><input name="ref" defaultValue={nextRef} required /></label>
          <label><span>Category</span><Select name="category" required options={cats.map(c => ({ value: c.key, label: c.label }))} /></label>
          <label className="grow"><span>Detail</span><input name="detail" placeholder="What the money was used for" required /></label>
          <label><span>Source document</span><input name="source" placeholder="Invoice or voucher no." /></label>
          <label><span>Amount (₦)</span><input name="amount" inputMode="numeric" placeholder="50000" required /></label>
          <button className="ad-btn ad-btn--primary" type="submit">Add entry</button>
        </form>
      </Card>
      <Card title="Ledger" meta={<span className="mono">{rows.length} entries · {naira(total)}</span>} flush>
        {rows.length ? (
          <table className="ad-table ad-table--cards">
            <thead><tr><th>Date</th><th>Reference</th><th>Category</th><th>Detail</th><th>Source</th><th className="r">Amount</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map(l => (
                <tr key={l.id}>
                  <td data-label="Date" className="dim nowrap">{watDate(l.entry_date)}</td><td data-label="Reference" className="mono">{l.ref}</td>
                  <td data-label="Category"><Pill tone="accent">{cats.find(c => c.key === l.category)?.label || l.category}</Pill></td>
                  <td data-label="Detail">{l.detail}</td><td data-label="Source" className="mono dim">{l.source_doc || '-'}</td><td data-label="Amount" className="r mono">{naira(l.amount_kobo)}</td>
                  <td data-label="" className="r"><form action={deleteLedger}><input type="hidden" name="id" value={l.id} /><ConfirmButton message={`Delete ledger entry ${l.ref}? It will disappear from the public page.`}>Delete</ConfirmButton></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty title="No ledger entries yet.">Add the first verified allocation above.</Empty>}
      </Card>
    </>
  );
}

/* ============================== UPDATES ============================ */
export async function Updates() {
  const { data } = await db().from('campaign_updates').select('*').order('published_on', { ascending: false });
  const rows = data || [];
  return (
    <>
      <Card title="Publish an update">
        <form action={addUpdate} className="ad-form">
          <div className="ad-form--row">
            <label><span>Date</span><input type="date" name="date" defaultValue={today()} required /></label>
            <label className="grow"><span>Title</span><input name="title" placeholder="Structural survey completed" required /></label>
          </div>
          <label><span>Details (optional)</span><textarea name="body" rows={3} placeholder="One or two sentences for Builders." /></label>
          <div><button className="ad-btn ad-btn--primary" type="submit">Publish update</button></div>
        </form>
      </Card>
      <Card title="Published" meta={<span>{rows.length} updates</span>}>
        {rows.length ? (
          <ol className="ad-timeline">
            {rows.map(u => (
              <li key={u.id}>
                <span className="ad-timeline__date mono">{watDate(u.published_on)}</span>
                <div><b>{u.title}</b>{u.body ? <p>{u.body}</p> : null}</div>
                <form action={deleteUpdate}><input type="hidden" name="id" value={u.id} /><ConfirmButton message={`Delete the update "${u.title}"?`}>Delete</ConfirmButton></form>
              </li>
            ))}
          </ol>
        ) : <Empty title="No updates yet.">Publish the first campaign update above.</Empty>}
      </Card>
    </>
  );
}

/* ============================ MILESTONES =========================== */
export async function Milestones() {
  const { data } = await db().from('milestones').select('*').order('position');
  const rows = data || [];
  const tone = (s: string) => (s === 'complete' ? 'success' : s === 'in-progress' ? 'accent' : 'neutral') as 'success' | 'accent' | 'neutral';
  return (
    <Card title="Verified milestones" meta={<span>Only mark a milestone complete once it has been verified</span>}>
      <ol className="ad-steps">
        {rows.map(m => (
          <li key={m.position} className={`ad-step ad-step--${m.status}`}>
            <i className="ad-step__dot" aria-hidden="true" />
            <form action={saveMilestone} className="ad-form ad-form--row">
              <input type="hidden" name="position" value={m.position} />
              <label className="grow"><span>Milestone {String(m.position).padStart(2, '0')}</span><input name="label" defaultValue={m.label} required /></label>
              <label><span>Status</span><Select name="status" defaultValue={m.status} options={STATUS_OPTIONS} /></label>
              <label><span>Verified on</span><input type="date" name="verified_on" defaultValue={m.verified_on || ''} /></label>
              <Pill tone={tone(m.status)}>{m.status === 'complete' ? 'Verified' : m.status === 'in-progress' ? 'In progress' : 'Upcoming'}</Pill>
              <button className="ad-btn ad-btn--ghost" type="submit">Save</button>
            </form>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ============================== BUDGET ============================= */
export async function Budget() {
  const { data } = await db().from('budget_lines').select('*').order('position');
  const rows = data || [];
  const set = rows.reduce((s, b) => s + (b.amount_kobo == null ? 0 : Number(b.amount_kobo)), 0);
  const over = set > CAMPAIGN.targetKobo;
  return (
    <>
      <div className="ad-kpis ad-kpis--3">
        <Kpi label="Budgeted" value={naira(set)} progress={pct(set, CAMPAIGN.targetKobo)} sub={`${pct(set, CAMPAIGN.targetKobo).toFixed(1)}% of the ₦400M target`} />
        <Kpi label="Still to budget" value={naira(Math.max(0, CAMPAIGN.targetKobo - set))} sub={over ? 'Budget is above the target' : 'Lines left blank are not yet budgeted'} />
        <Kpi label="Lines set" value={`${rows.filter(b => b.amount_kobo != null).length} / ${rows.length}`} />
      </div>
      <Card title="Budget allocation" meta={<span>Private, for the team only</span>}>
        <div className="ad-rows">
          {rows.map(b => (
            <form key={b.key} action={saveBudgetLine} className="ad-form ad-form--row ad-rows__row">
              <input type="hidden" name="key" value={b.key} />
              <label><span>Label</span><input name="label" defaultValue={b.label} required /></label>
              <label className="grow"><span>Note</span><input name="note" defaultValue={b.note || ''} /></label>
              <label><span>Amount (₦)</span><input name="amount" inputMode="numeric" defaultValue={koboToInput(b.amount_kobo)} placeholder="TBC" /></label>
              <span className="ad-rows__pct mono">{b.amount_kobo == null ? 'TBC' : `${pct(Number(b.amount_kobo), CAMPAIGN.targetKobo).toFixed(1)}%`}</span>
              <button className="ad-btn ad-btn--ghost" type="submit">Save</button>
            </form>
          ))}
        </div>
      </Card>
    </>
  );
}

/* =========================== IMPACT INDEX ========================== */
export async function Index() {
  const { data } = await db().from('impact_index').select('*').order('position');
  const rows = data || [];
  return (
    <Card title="Impact Index" meta={<span>Project milestone progress, never a price or return</span>}>
      <div className="ad-rows">
        {rows.map(i => (
          <form key={i.position} action={saveIndex} className="ad-form ad-form--row ad-rows__row">
            <input type="hidden" name="position" value={i.position} />
            <label className="grow"><span>Component</span><input name="label" defaultValue={i.label} required /></label>
            <label><span>Progress %</span><NumberField name="value" min={0} max={100} defaultValue={i.value} suffix="%" placeholder="Not set" /></label>
            <label><span>Verified on</span><input type="date" name="verified_on" defaultValue={i.verified_on || ''} /></label>
            <span className="ad-meter" aria-hidden="true"><i style={{ width: `${i.value ?? 0}%` }} /></span>
            <button className="ad-btn ad-btn--ghost" type="submit">Save</button>
          </form>
        ))}
      </div>
    </Card>
  );
}

/* ========================= ALLOCATED & SPENT ======================= */
export async function Totals() {
  const [t, settings, lastRun, waiting] = await Promise.all([totals(), db().from('settings').select('*'), lastDailyRun(), unsentReceipts()]);
  const setting = (k: string) => (settings.data || []).find(s => s.key === k)?.value ?? null;
  const allocated = setting('allocated_kobo'), spent = setting('spent_kobo');
  const opening = Number(setting('opening_kobo')) || 0;
  const paid = Number(t.raised_kobo);
  const shown = paid + opening;
  return (
    <>
      <div className="ad-kpis ad-kpis--3">
        <Kpi label="Shown as raised" value={naira(shown)} sub={`${pct(shown, CAMPAIGN.targetKobo).toFixed(2)}% of ${naira(CAMPAIGN.targetKobo)}`} progress={pct(shown, CAMPAIGN.targetKobo)} />
        <Kpi label="Confirmed payments" value={naira(paid)} sub={`${num(t.builders)} ${t.builders === 1 ? 'Builder' : 'Builders'}`} />
        <Kpi label="Starting amount" value={naira(opening)} sub={opening ? `${num(Math.floor(opening / CAMPAIGN.unitPriceKobo))} bricks` : 'Not set'} />
      </div>

      <Card title="Campaign starting amount" meta={<span>Public: added to the raised total and bricks laid</span>}>
        <p className="ad-help">Money already raised before the site went live (for example pledges, events or bank transfers). It is added to &ldquo;raised&rdquo; everywhere on the public page. It does not create Builders or appear on the Builder wall. Enter 0 to remove it.</p>
        <ActionForm action={saveOpening} className="ad-form ad-form--row">
          <label><span>Starting amount (₦)</span><input name="opening" inputMode="numeric" defaultValue={koboToInput(opening || null)} placeholder="0" /></label>
          <SubmitButton>Save starting amount</SubmitButton>
        </ActionForm>
      </Card>

      <div id="automation">
        <Card title="Emails and the daily check" meta={<span>Runs automatically every day at about 7:00 WAT</span>}>
          <div className="ad-kpis ad-kpis--inline">
            <Kpi label="Receipts waiting" value={num(waiting)} sub={!hasEmail() ? 'Email is not set up yet' : waiting ? 'Sent by the next run, or with the button below' : 'Every receipt has been sent'} />
            <Kpi label="Last automatic check" value={lastRun ? when(lastRun.at) : 'Not run yet'} sub={lastRun ? (lastRun.ok ? `OK${lastRun.trigger === 'admin' ? ', run from the admin' : ''}` : 'Found a problem: see System alerts') : 'Starts once the site is deployed on Vercel'} />
          </div>
          <p className="ad-help">Every day this check keeps the database active (so a free Supabase project never pauses), confirms with Paystack any payment still pending (donors who closed the tab before returning; the site also checks every few minutes while it has visitors), confirms the Brevo key still works (keys expire after 90 days unused), and sends any receipts held back by Brevo's daily limit of 300. Problems appear in System alerts on the Overview.</p>
          <div className="ad-actions">
            <ActionForm action={sendReceiptsNow} className="ad-form ad-form--row">
              <SubmitButton pending="Sending…">Send waiting receipts now</SubmitButton>
            </ActionForm>
            <ActionForm action={checkPaymentsNow} className="ad-form ad-form--row">
              <SubmitButton pending="Checking with Paystack…" className="ad-btn ad-btn--ghost">Check pending payments now</SubmitButton>
            </ActionForm>
            <ActionForm action={runDailyNow} className="ad-form ad-form--row">
              <SubmitButton pending="Checking…" className="ad-btn ad-btn--ghost">Run the daily check now</SubmitButton>
            </ActionForm>
          </div>
        </Card>
      </div>

      <Card title="Allocated and spent" meta={<span>Private, for the team only</span>}>
        <div className="ad-kpis ad-kpis--inline">
          <Kpi label="Allocated" value={allocated == null ? 'Not set' : naira(Number(allocated))} sub={allocated == null ? undefined : `${pct(Number(allocated), shown).toFixed(1)}% of raised`} />
          <Kpi label="Spent" value={spent == null ? 'Not set' : naira(Number(spent))} sub={spent == null ? undefined : `${pct(Number(spent), shown).toFixed(1)}% of raised`} />
        </div>
        <ActionForm action={saveTotals} className="ad-form ad-form--row">
          <label><span>Allocated (₦)</span><input name="allocated" inputMode="numeric" defaultValue={koboToInput(allocated)} placeholder="Not set" /></label>
          <label><span>Spent (₦)</span><input name="spent" inputMode="numeric" defaultValue={koboToInput(spent)} placeholder="Not set" /></label>
          <SubmitButton>Save figures</SubmitButton>
        </ActionForm>
      </Card>

      <Card title="Danger zone" meta={<span>Cannot be undone</span>}>
        <div className="ad-danger">
          <div>
            <b>Clear all contributions and Builders</b>
            <p className="ad-help">Deletes every payment record ({num(t.builders)} {t.builders === 1 ? 'Builder' : 'Builders'}, {naira(paid)}) and restarts Builder and receipt numbers at #000001 and SIX-2026-000001. Use it to remove test payments before launch. The ledger, updates, milestones, budget and starting amount are kept. Payments stay in your Paystack dashboard.</p>
          </div>
          <ActionForm action={clearAll} className="ad-form ad-form--row">
            <label><span>Type {CLEAR_PHRASE} to confirm</span><input name="confirm" autoComplete="off" placeholder={CLEAR_PHRASE} required /></label>
            <ConfirmButton className="ad-btn ad-btn--danger" pending="Clearing…" message={`Delete all ${num(t.builders)} Builders and every contribution? This cannot be undone.`}>Clear everything</ConfirmButton>
          </ActionForm>
        </div>
      </Card>
    </>
  );
}
