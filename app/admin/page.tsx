import type { Metadata } from 'next';
import { adminConfigured, isAdmin } from '@/lib/admin';
import { hasDatabase, hasPayments } from '@/lib/env';
import { login } from './actions';
import { Shell, VIEWS, type View } from './ui';
import { Budget, Contributions, Index, Ledger, Milestones, Overview, Totals, Updates } from './views';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin | Smartan Impact Exchange', robots: { index: false, follow: false } };

type Search = Promise<{ view?: string; error?: string; saved?: string; status?: string; q?: string; page?: string; receipt?: string }>;

const TITLES: Record<View, [string, string]> = {
  overview: ['Overview', 'The campaign at a glance.'],
  contributions: ['Contributions', 'Every payment, confirmed by Paystack.'],
  ledger: ['Transparency ledger', 'Verified allocations and spending, published in "Follow every naira".'],
  updates: ['Campaign updates', 'News for Builders, shown on the public page.'],
  milestones: ['Milestones', 'The physical build, step by step.'],
  budget: ['Budget', 'How the ₦300M target is allocated.'],
  index: ['Impact Index', 'Verified project milestone progress.'],
  totals: ['Allocated and spent', 'The headline transparency figures.'],
};

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <main className="ad-gate">
      <div className="ad-gate__card">
        <img src="/assets/logo-mark.png" alt="" width={44} height={42} />
        {children}
      </div>
      <p className="ad-gate__foot">Smartan Impact Exchange</p>
    </main>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;

  if (!adminConfigured()) {
    return <Gate><h1>Admin is not set up</h1><p>Set <code>ADMIN_PASSWORD</code> (at least 10 characters) and <code>ADMIN_SESSION_SECRET</code> (at least 32 characters) in your environment, then reload.</p></Gate>;
  }
  if (!(await isAdmin())) {
    return (
      <Gate>
        <h1>Campaign admin</h1>
        <p>Sign in to manage the Smartan House facility campaign.</p>
        <form action={login} className="ad-form">
          <label><span>Password</span><input type="password" name="password" required autoFocus autoComplete="current-password" /></label>
          {q.error ? <p className="ad-error" role="alert">That password is not right.</p> : null}
          <button className="ad-btn ad-btn--primary ad-btn--block" type="submit">Sign in</button>
        </form>
      </Gate>
    );
  }
  if (!hasDatabase()) {
    return <Gate><h1>Database is not connected</h1><p>Set <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code>, and run <code>supabase/schema.sql</code> once.</p></Gate>;
  }

  const view = (VIEWS.some(v => v.key === q.view) ? q.view : 'overview') as View;
  const [title, sub] = TITLES[view];
  const status = ['success', 'pending', 'failed'].includes(q.status || '') ? q.status! : 'success';
  const page = Math.max(1, Number(q.page) || 1);

  const actions = view === 'contributions'
    ? <a className="ad-btn ad-btn--ghost" href={`/admin/export?status=${status}`}>Export CSV</a>
    : view === 'overview'
      ? <><a className="ad-btn ad-btn--ghost" href="/admin/export?status=success">Export CSV</a><a className="ad-btn ad-btn--primary" href="/admin?view=ledger">Add ledger entry</a></>
      : null;

  return (
    <Shell
      view={view} title={title} sub={sub} actions={actions} saved={Boolean(q.saved)}
      warn={!hasPayments() ? <>Payments are off. Add <code>PAYSTACK_SECRET_KEY</code> to start accepting contributions.</> : null}
    >
      {view === 'overview' && <Overview />}
      {view === 'contributions' && <Contributions status={status} q={q.q || ''} page={page} receipt={q.receipt} />}
      {view === 'ledger' && <Ledger />}
      {view === 'updates' && <Updates />}
      {view === 'milestones' && <Milestones />}
      {view === 'budget' && <Budget />}
      {view === 'index' && <Index />}
      {view === 'totals' && <Totals />}
    </Shell>
  );
}
