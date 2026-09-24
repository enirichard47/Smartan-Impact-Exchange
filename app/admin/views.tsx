import { db } from '@/lib/db';
import { CAMPAIGN } from '@/lib/env';
import { builderId, naira, num, receiptNo, watDate, watTime } from '@/lib/format';
import {
  addLedger, addUpdate, deleteLedger, deleteUpdate,
  saveBudgetLine, saveIndex, saveMilestone, saveTotals,
} from './actions';
import { ConfirmButton } from './confirm-button';
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
const count = async (build: (q: any) => any) => {
  const { count: c } = await build(db().from('contributions').select('id', { count: 'exact', head: true }));
  return c || 0;
};

/* ============================ OVERVIEW ============================ */
export async function Overview() {
  const [t, pending, failed, unsent, daily, recent, milestones] = await Promise.all([
    totals(),
    count(q => q.eq('status', 'pending')),
    count(q => q.eq('status', 'failed')),
    count(q => q.eq('status', 'success').is('receipt_sent_at', null)),
    db().rpc('daily_bricks', { p_days: 30 }),
    db().from('contributions').select('reference, units, amount_kobo, name, city, paid_at, builders(number)').eq('status', 'success').order('paid_at', { ascending: false }).limit(8),
    db().from('milestones').select('*').order('position'),
  ]);
  const raisedPct = pct(Number(t.raised_kobo), CAMPAIGN.targetKobo);
  const days = ((daily.data || []) as { day: string; units: number }[]).map(d => ({ day: String(d.day), units: Number(d.units) }));
  const last30 = days.reduce((s, d) => s + d.units, 0);
  const ms = milestones.data || [];
  const done = ms.filter(m => m.status === 'complete').length;

  return (
    <>
      <div className="ad-kpis">
        <Kpi label="Raised" value={naira(t.raised_kobo)} sub={`${raisedPct.toFixed(2)}% of ${naira(CAMPAIGN.targetKobo)}`} progress={raisedPct} />
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
          </ul>
        </Card>
      </div>

      <Card title="Latest Builders" meta={<a className="ad-link" href="/admin?view=contributions">View all →</a>} flush>
        {recent.data?.length ? (
          <table className="ad-table">
            <thead><tr><th>Builder</th><th>Name</th><th>City</th><th className="r">Bricks</th><th className="r">Amount</th><th className="r">Paid</th></tr></thead>
            <tbody>
              {recent.data.map((c: any) => {
                const b = Array.isArray(c.builders) ? c.builders[0] : c.builders;
                return (
                  <tr key={c.reference}>
                    <td className="mono">{b ? builderId(b.number) : '-'}</td><td>{c.name}</td><td className="dim">{c.city || '-'}</td>
                    <td className="r mono">{num(c.units)}</td><td className="r mono">{naira(c.amount_kobo)}</td><td className="r dim">{when(c.paid_at)}</td>
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
          <table className="ad-table">
            <thead><tr><th>Date</th><th>Builder</th><th>Name</th><th>Email</th><th>Phone</th><th>City</th><th className="r">Bricks</th><th className="r">Amount</th><th>Channel</th><th>Receipt no.</th><th>Emailed</th><th>Paystack ref</th></tr></thead>
            <tbody>
              {data.map((c: any) => {
                const b = Array.isArray(c.builders) ? c.builders[0] : c.builders;
                return (
                  <tr key={c.reference}>
                    <td className="dim nowrap">{when(c.paid_at || c.created_at)}</td>
                    <td className="mono">{b ? builderId(b.number) : '-'}</td>
                    <td className="nowrap">{c.name}{c.display === 'anonymous' ? <Pill tone="neutral">Anonymous</Pill> : null}</td>
                    <td>{c.email}</td><td className="dim">{c.phone || '-'}</td><td className="dim">{c.city || '-'}</td>
                    <td className="r mono">{num(c.units)}</td><td className="r mono">{naira(c.amount_kobo)}</td>
                    <td className="dim">{c.channel || '-'}</td>
                    <td className="mono nowrap">{receiptNo(c.receipt_number) || '-'}</td>
                    <td>{c.status === 'success' ? (c.receipt_sent_at ? <Pill tone="success">Sent</Pill> : <Pill tone="pending">Not sent</Pill>) : c.status === 'pending' ? <Pill tone="pending">Pending</Pill> : <Pill tone="failed">Failed</Pill>}</td>
                    <td className="mono dim">{c.reference}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty title={safeQ ? 'No matches.' : 'Nothing here yet.'}>{safeQ ? 'Try a different name, email, receipt number or reference.' : 'Contributions appear here as soon as Builders start paying.'}</Empty>}
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
          <table className="ad-table">
            <thead><tr><th>Date</th><th>Reference</th><th>Category</th><th>Detail</th><th>Source</th><th className="r">Amount</th><th /></tr></thead>
            <tbody>
              {rows.map(l => (
                <tr key={l.id}>
                  <td className="dim nowrap">{watDate(l.entry_date)}</td><td className="mono">{l.ref}</td>
                  <td><Pill tone="accent">{cats.find(c => c.key === l.category)?.label || l.category}</Pill></td>
                  <td>{l.detail}</td><td className="mono dim">{l.source_doc || '-'}</td><td className="r mono">{naira(l.amount_kobo)}</td>
                  <td className="r"><form action={deleteLedger}><input type="hidden" name="id" value={l.id} /><ConfirmButton message={`Delete ledger entry ${l.ref}? It will disappear from the public page.`}>Delete</ConfirmButton></form></td>
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
        <Kpi label="Budgeted" value={naira(set)} progress={pct(set, CAMPAIGN.targetKobo)} sub={`${pct(set, CAMPAIGN.targetKobo).toFixed(1)}% of the ₦300M target`} />
        <Kpi label="Still to budget" value={naira(Math.max(0, CAMPAIGN.targetKobo - set))} sub={over ? 'Budget is above the target' : 'Lines left blank show "TBC"'} />
        <Kpi label="Lines set" value={`${rows.filter(b => b.amount_kobo != null).length} / ${rows.length}`} />
      </div>
      <Card title="What ₦300M builds" meta={<span>From Smartan's approved project budget</span>}>
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
  const [t, settings] = await Promise.all([totals(), db().from('settings').select('*')]);
  const setting = (k: string) => (settings.data || []).find(s => s.key === k)?.value ?? null;
  const allocated = setting('allocated_kobo'), spent = setting('spent_kobo');
  return (
    <>
      <div className="ad-kpis ad-kpis--3">
        <Kpi label="Raised" value={naira(t.raised_kobo)} />
        <Kpi label="Allocated" value={allocated == null ? 'Not published' : naira(Number(allocated))} sub={allocated == null ? undefined : `${pct(Number(allocated), Number(t.raised_kobo)).toFixed(1)}% of raised`} />
        <Kpi label="Spent" value={spent == null ? 'Not published' : naira(Number(spent))} sub={spent == null ? undefined : `${pct(Number(spent), Number(t.raised_kobo)).toFixed(1)}% of raised`} />
      </div>
      <Card title="Update the published figures" meta={<span>Leave a field blank to show "Published once verified"</span>}>
        <form action={saveTotals} className="ad-form ad-form--row">
          <label><span>Allocated (₦)</span><input name="allocated" inputMode="numeric" defaultValue={koboToInput(allocated)} placeholder="Not published" /></label>
          <label><span>Spent (₦)</span><input name="spent" inputMode="numeric" defaultValue={koboToInput(spent)} placeholder="Not published" /></label>
          <button className="ad-btn ad-btn--primary" type="submit">Save figures</button>
        </form>
      </Card>
    </>
  );
}
