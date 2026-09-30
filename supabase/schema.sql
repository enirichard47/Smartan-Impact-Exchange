-- ============================================================================
-- Smartan Impact Exchange: database schema (Supabase / Postgres)
-- Run once in the Supabase SQL editor. Safe to re-run: it only creates what is
-- missing and seeds the default milestones, budget lines and index labels.
--
-- All access goes through the Next.js server using the service-role key.
-- Row Level Security is enabled with NO public policies, so the anon key can
-- read nothing (Builder emails and phone numbers never leave the server).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------- Builders & contributions ----------------------------------------

-- Builder numbers are handed out in order, only when a payment is confirmed.
create sequence if not exists builder_number_seq start 1;

-- Receipt numbers (shown as SIX-2026-000123) are also handed out in order, only on
-- confirmation, so failed or abandoned checkouts never leave gaps.
create sequence if not exists receipt_number_seq start 1;

create table if not exists builders (
  id          uuid primary key default gen_random_uuid(),
  number      integer not null unique default nextval('builder_number_seq'),
  email       text not null unique,                    -- stored lower-case
  name        text,
  city        text,
  display     text not null default 'name' check (display in ('name', 'anonymous')),
  created_at  timestamptz not null default now()
);

create table if not exists contributions (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique,               -- our Paystack reference
  units            integer not null check (units >= 1),
  amount_kobo      bigint not null check (amount_kobo > 0),
  currency         text not null default 'NGN',
  email            text not null,
  name             text not null,
  phone            text,
  city             text,
  display          text not null default 'name' check (display in ('name', 'anonymous')),
  status           text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  builder_id       uuid references builders(id),
  paystack_id      bigint,
  channel          text,
  paid_at          timestamptz,
  receipt_sent_at  timestamptz,
  receipt_number   integer unique,                     -- given when the payment is confirmed
  created_at       timestamptz not null default now()
);
create index if not exists contributions_success_paid_idx on contributions (paid_at desc) where status = 'success';
create index if not exists contributions_builder_idx on contributions (builder_id);

-- Upgrading an older install: add receipt numbers, then number the payments
-- already confirmed, oldest first.
alter table contributions add column if not exists receipt_number integer unique;
do $$
declare r record;
begin
  for r in select id from contributions where status = 'success' and receipt_number is null order by paid_at, created_at loop
    update contributions set receipt_number = nextval('receipt_number_seq') where id = r.id;
  end loop;
end
$$;

-- Confirm a payment exactly once. Called by the Paystack webhook and the
-- redirect-back page; whichever arrives first wins, the other is a no-op.
-- Raises if the amount Paystack reports does not match what we charged.
-- (Dropped first because its result columns changed when receipt numbers were added.)
drop function if exists confirm_contribution(text, bigint, text, bigint, text, timestamptz);
create or replace function confirm_contribution(
  p_reference   text,
  p_amount_kobo bigint,
  p_currency    text,
  p_paystack_id bigint,
  p_channel     text,
  p_paid_at     timestamptz
)
returns table (
  builder_number  integer,
  units           integer,
  amount_kobo     bigint,
  name            text,
  email           text,
  total_units     bigint,
  newly_confirmed boolean,
  receipt_number  integer
)
language plpgsql
as $$
declare
  c contributions%rowtype;
  b builders%rowtype;
  fresh boolean := false;
begin
  select * into c from contributions where reference = p_reference for update;
  if not found then
    raise exception 'unknown reference %', p_reference;
  end if;

  if c.status <> 'success' then
    if p_amount_kobo <> c.amount_kobo or upper(p_currency) <> upper(c.currency) then
      raise exception 'amount mismatch for %', p_reference;
    end if;

    select * into b from builders where builders.email = lower(c.email);
    if not found then
      begin
        insert into builders (email, name, city, display)
        values (lower(c.email), c.name, c.city, c.display)
        returning * into b;
      exception when unique_violation then
        select * into b from builders where builders.email = lower(c.email);
      end;
    else
      update builders
         set name = c.name, city = coalesce(c.city, builders.city), display = c.display
       where id = b.id
      returning * into b;
    end if;

    update contributions
       set status = 'success', builder_id = b.id, paystack_id = p_paystack_id,
           channel = p_channel, paid_at = coalesce(p_paid_at, now()),
           receipt_number = nextval('receipt_number_seq')
     where id = c.id
    returning * into c;
    fresh := true;
  else
    select * into b from builders where id = c.builder_id;
  end if;

  return query
    select b.number, c.units, c.amount_kobo, c.name, c.email,
           (select coalesce(sum(x.units), 0) from contributions x where x.builder_id = b.id and x.status = 'success'),
           fresh, c.receipt_number;
end;
$$;

-- Clear every contribution and Builder (e.g. test payments before launch) and
-- restart Builder and receipt numbers at 1. Called from the admin page only.
-- Campaign content (ledger, updates, milestones, budget, settings) is kept.
-- Runs with the rights of its owner (security definer), because restarting the
-- numbering needs more than the app's own database role is allowed to do.
-- Only the server can call it (see the revoke at the end of this file).
create or replace function reset_campaign()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from contributions where true;
  delete from builders where true;
  perform setval('builder_number_seq', 1, false);   -- the next Builder is #000001
  perform setval('receipt_number_seq', 1, false);   -- the next receipt is SIX-2026-000001
end;
$$;

-- ---------- Receipt emails: claim before sending ------------------------------
-- A receipt is "claimed" before it is emailed, so the live payment path, the daily
-- catch-up job and the admin button can never send the same receipt twice.
-- A claim older than 15 minutes (a send that crashed) can be claimed again.
alter table contributions add column if not exists receipt_claimed_at timestamptz;

-- Claim one receipt (live path). True when this caller may send it.
create or replace function claim_receipt(p_reference text)
returns boolean
language plpgsql
as $$
declare n integer;
begin
  update contributions set receipt_claimed_at = now()
   where reference = p_reference and status = 'success' and receipt_sent_at is null
     and (receipt_claimed_at is null or receipt_claimed_at < now() - interval '15 minutes');
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

-- Claim up to p_limit unsent receipts, oldest payment first (daily job, admin button).
-- skip locked: two runs at the same moment get different receipts, never the same one.
create or replace function claim_unsent_receipts(p_limit integer)
returns table (
  reference       text,
  receipt_number  integer,
  builder_number  integer,
  units           integer,
  total_units     bigint,
  amount_kobo     bigint,
  name            text,
  email           text,
  paid_at         timestamptz
)
language plpgsql
as $$
begin
  return query
  with picked as (
    select c.id from contributions c
     where c.status = 'success' and c.receipt_sent_at is null
       and (c.receipt_claimed_at is null or c.receipt_claimed_at < now() - interval '15 minutes')
     order by c.paid_at
     limit p_limit
     for update skip locked
  ), claimed as (
    update contributions c set receipt_claimed_at = now()
      from picked where c.id = picked.id
    returning c.*
  )
  select cl.reference, cl.receipt_number, b.number, cl.units,
         (select coalesce(sum(x.units), 0) from contributions x where x.builder_id = b.id and x.status = 'success'),
         cl.amount_kobo, cl.name, cl.email, cl.paid_at
    from claimed cl join builders b on b.id = cl.builder_id
   order by cl.paid_at;
end;
$$;

-- Rate limiting for "Pay" (checkout): counts attempts per key (a hashed IP address
-- or an email) in fixed time windows. Shared by every server instance, so the
-- limit holds however many copies of the site are running.
create table if not exists rate_limits (
  key           text        not null,
  window_start  timestamptz not null,
  hits          integer     not null default 0,
  primary key (key, window_start)
);

-- Records one attempt and says whether it is allowed (true) or over the limit (false).
create or replace function hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into rate_limits (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into n;
  -- tidy up now and then, so the table never grows large
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;
  return n <= p_limit;
end;
$$;

-- Live totals for the page.
create or replace view campaign_totals as
  select coalesce(sum(amount_kobo), 0)::bigint as raised_kobo,
         count(distinct builder_id)::integer   as builders,
         coalesce(sum(units), 0)::bigint       as units,
         max(paid_at)                          as updated_at
    from contributions
   where status = 'success';

-- Bricks laid per day (WAT) for the last N days, oldest first.
create or replace function daily_bricks(p_days integer default 30)
returns table (day date, units bigint)
language sql stable
as $$
  with days as (
    select generate_series(
             (now() at time zone 'Africa/Lagos')::date - (p_days - 1),
             (now() at time zone 'Africa/Lagos')::date,
             interval '1 day')::date as day
  )
  select d.day, coalesce(sum(c.units), 0)::bigint
    from days d
    left join contributions c
      on c.status = 'success'
     and (c.paid_at at time zone 'Africa/Lagos')::date = d.day
   group by d.day
   order by d.day;
$$;

-- ---------- Campaign content (edited from /admin) ---------------------------

create table if not exists ledger_entries (
  id           uuid primary key default gen_random_uuid(),
  entry_date   date not null,
  ref          text not null unique,
  category     text not null,                           -- matches a budget_lines.key
  detail       text not null,
  amount_kobo  bigint not null check (amount_kobo > 0),
  source_doc   text,                                    -- invoice / payment voucher, shown publicly
  created_at   timestamptz not null default now()
);
alter table ledger_entries add column if not exists source_doc text;

create table if not exists campaign_updates (
  id            uuid primary key default gen_random_uuid(),
  published_on  date not null,
  title         text not null,
  body          text,
  created_at    timestamptz not null default now()
);

create table if not exists milestones (
  position     integer primary key,
  label        text not null,
  status       text not null default 'upcoming' check (status in ('upcoming', 'in-progress', 'complete')),
  verified_on  date
);

create table if not exists budget_lines (
  key          text primary key,
  position     integer not null,
  label        text not null,
  note         text,
  amount_kobo  bigint                                    -- null until the budget is approved
);

create table if not exists impact_index (
  position     integer primary key,
  label        text not null,
  value        numeric check (value between 0 and 100),  -- null until verified
  verified_on  date
);

create table if not exists settings (
  key    text primary key,
  value  jsonb
);

-- Problems the server ran into (a failed receipt email, Paystack or the database
-- not responding), shown to admins as "System alerts" on the admin Overview.
create table if not exists system_log (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  source   text not null,                               -- payments, email, database, admin
  message  text not null,                               -- plain words, for the admin
  detail   text                                         -- the technical error, shortened
);
create index if not exists system_log_at_idx on system_log (at desc);

-- ---------- Seeds (only inserted if missing) --------------------------------

insert into milestones (position, label) values
  (1, 'Foundation'), (2, 'Structure'), (3, 'Infrastructure'),
  (4, 'Acorn Hub'), (5, 'Equipment'), (6, 'Launch')
on conflict (position) do nothing;

insert into budget_lines (key, position, label, note) values
  ('facility',   1, 'Facility',                'Acquisition, renovation and build-out of the new Smartan House facility.'),
  ('acorn',      2, 'Acorn Incubator',         'Fit-out of the Acorn Incubator Hub.'),
  ('technology', 3, 'Technology',              'Connectivity, power and devices.'),
  ('learning',   4, 'Learning infrastructure', 'Classrooms, studios and study spaces.'),
  ('equipment',  5, 'Equipment',               'Furniture and equipment for every space.'),
  ('operations', 6, 'Operational setup',       'The systems needed to open the doors.')
on conflict (key) do nothing;

insert into impact_index (position, label) values
  (1, 'Facility development'), (2, 'Acorn development'),
  (3, 'Infrastructure'), (4, 'Campaign readiness')
on conflict (position) do nothing;

insert into settings (key, value) values
  ('allocated_kobo', 'null'::jsonb), ('spent_kobo', 'null'::jsonb), ('opening_kobo', '0'::jsonb)
on conflict (key) do nothing;

-- ---------- Lock everything down --------------------------------------------

alter table builders          enable row level security;
alter table contributions     enable row level security;
alter table ledger_entries    enable row level security;
alter table campaign_updates  enable row level security;
alter table milestones        enable row level security;
alter table budget_lines      enable row level security;
alter table impact_index      enable row level security;
alter table settings          enable row level security;
alter table system_log        enable row level security;
alter table rate_limits       enable row level security;

revoke all on campaign_totals from anon, authenticated;
revoke execute on function confirm_contribution(text, bigint, text, bigint, text, timestamptz) from public, anon, authenticated;
revoke execute on function daily_bricks(integer) from public, anon, authenticated;
revoke execute on function reset_campaign() from public, anon, authenticated;
revoke execute on function hit_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function claim_receipt(text) from public, anon, authenticated;
revoke execute on function claim_unsent_receipts(integer) from public, anon, authenticated;
