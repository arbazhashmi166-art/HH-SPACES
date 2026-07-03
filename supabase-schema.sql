create extension if not exists pgcrypto;

create table if not exists public.hh_spaces_app_state (
  id text primary key default 'main',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.hh_spaces_app_state enable row level security;

drop policy if exists "hh spaces public read" on public.hh_spaces_app_state;
drop policy if exists "hh spaces public insert" on public.hh_spaces_app_state;
drop policy if exists "hh spaces public update" on public.hh_spaces_app_state;

create policy "hh spaces public read"
on public.hh_spaces_app_state
for select
to anon
using (id = 'main');

create policy "hh spaces public insert"
on public.hh_spaces_app_state
for insert
to anon
with check (id = 'main');

create policy "hh spaces public update"
on public.hh_spaces_app_state
for update
to anon
using (id = 'main')
with check (id = 'main');

grant select, insert, update on public.hh_spaces_app_state to anon;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id text default 'main',
  invoice_no text not null,
  invoice_type text not null default 'Tax Invoice',
  invoice_date date not null default current_date,
  due_date date,
  client_name text not null,
  site_name text,
  client_address text,
  gst_number text,
  pan_number text,
  payment_terms text,
  notes text,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  gst_total numeric not null default 0,
  tds_percent numeric not null default 0,
  tds_amount numeric not null default 0,
  grand_total numeric not null default 0,
  paid_amount numeric not null default 0,
  balance_amount numeric not null default 0,
  status text not null default 'Draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric not null default 0,
  unit text not null default 'Sqft',
  rate numeric not null default 0,
  amount numeric not null default 0,
  gst_percent numeric not null default 0,
  gst_amount numeric not null default 0,
  total numeric not null default 0
);

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric not null default 0,
  mode text not null default 'Cash',
  reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_templates (
  id uuid primary key default gen_random_uuid(),
  company_id text default 'main',
  template_name text not null,
  invoice_type text,
  terms text,
  footer text,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id text default 'main',
  client_name text not null,
  site_name text,
  frequency text not null default 'Monthly',
  next_date date not null,
  amount numeric not null default 0,
  status text not null default 'Active',
  created_at timestamptz not null default now()
);

create table if not exists public.payment_reminders (
  id uuid primary key default gen_random_uuid(),
  company_id text default 'main',
  invoice_id uuid references public.invoices(id) on delete cascade,
  reminder_type text not null,
  reminder_date date not null,
  message text,
  status text not null default 'Planned',
  created_at timestamptz not null default now()
);

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.invoice_templates enable row level security;
alter table public.recurring_invoices enable row level security;
alter table public.payment_reminders enable row level security;

drop policy if exists "invoice public all" on public.invoices;
drop policy if exists "invoice items public all" on public.invoice_items;
drop policy if exists "invoice payments public all" on public.invoice_payments;
drop policy if exists "invoice templates public all" on public.invoice_templates;
drop policy if exists "recurring invoices public all" on public.recurring_invoices;
drop policy if exists "payment reminders public all" on public.payment_reminders;

create policy "invoice public all" on public.invoices for all to anon using (company_id = 'main') with check (company_id = 'main');
create policy "invoice items public all" on public.invoice_items for all to anon using (true) with check (true);
create policy "invoice payments public all" on public.invoice_payments for all to anon using (true) with check (true);
create policy "invoice templates public all" on public.invoice_templates for all to anon using (company_id = 'main') with check (company_id = 'main');
create policy "recurring invoices public all" on public.recurring_invoices for all to anon using (company_id = 'main') with check (company_id = 'main');
create policy "payment reminders public all" on public.payment_reminders for all to anon using (company_id = 'main') with check (company_id = 'main');

grant select, insert, update, delete on public.invoices to anon;
grant select, insert, update, delete on public.invoice_items to anon;
grant select, insert, update, delete on public.invoice_payments to anon;
grant select, insert, update, delete on public.invoice_templates to anon;
grant select, insert, update, delete on public.recurring_invoices to anon;
grant select, insert, update, delete on public.payment_reminders to anon;
