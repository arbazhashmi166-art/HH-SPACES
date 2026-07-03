create extension if not exists "pgcrypto";
create extension if not exists "vector";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  gst_number text,
  pan_number text,
  address text,
  phone text,
  email text,
  bank_details text,
  upi_id text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  role text not null check (role in ('admin', 'staff', 'viewer')),
  status text not null default 'invited' check (status in ('active', 'invited', 'disabled')),
  can_delete_financial boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create or replace function public.user_company_ids()
returns table(company_id text)
language sql
security definer
set search_path = public
as $$
  select cm.company_id
  from public.company_members cm
  where cm.user_id = auth.uid()
    and cm.status = 'active'
    and cm.archived = false
    and cm.deleted_at is null
$$;

create or replace function public.user_role_for_company(target_company_id text)
returns text
language sql
security definer
set search_path = public
as $$
  select cm.role
  from public.company_members cm
  where cm.user_id = auth.uid()
    and cm.company_id = target_company_id
    and cm.status = 'active'
    and cm.archived = false
    and cm.deleted_at is null
  limit 1
$$;

create or replace function public.can_write_company(target_company_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(public.user_role_for_company(target_company_id) in ('admin', 'staff'), false)
$$;

create or replace function public.is_company_admin(target_company_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(public.user_role_for_company(target_company_id) = 'admin', false)
$$;

create table if not exists public.sites (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  name text not null,
  client_name text not null,
  client_mobile text,
  address text not null,
  work_type text not null,
  start_date date not null,
  expected_completion_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  budget numeric(14,2) not null default 0 check (budget >= 0),
  notes text,
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.labour (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  site_id text references public.sites(id) on delete set null,
  full_name text not null,
  mobile text,
  work_type text not null,
  default_daily_wage numeric(12,2) not null default 0 check (default_daily_wage >= 0),
  advance_payment numeric(12,2) not null default 0 check (advance_payment >= 0),
  balance_payment numeric(12,2) not null default 0 check (balance_payment >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.suppliers (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  name text not null,
  mobile text,
  material_type text,
  address text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.attendance (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  site_id text not null references public.sites(id) on delete restrict,
  labour_id text not null references public.labour(id) on delete restrict,
  date date not null,
  status text not null check (status in ('present', 'absent', 'half_day')),
  overtime_hours numeric(8,2) not null default 0 check (overtime_hours >= 0),
  daily_wage numeric(12,2) not null default 0 check (daily_wage >= 0),
  wage_amount numeric(12,2) not null default 0 check (wage_amount >= 0),
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.labour_payments (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  site_id text references public.sites(id) on delete set null,
  labour_id text not null references public.labour(id) on delete restrict,
  date date not null,
  amount numeric(12,2) not null check (amount >= 0),
  mode text not null check (mode in ('cash', 'upi', 'bank_transfer', 'cheque')),
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.materials (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  site_id text not null references public.sites(id) on delete restrict,
  supplier_id text references public.suppliers(id) on delete set null,
  date date not null,
  material_name text not null,
  quantity numeric(14,3) not null check (quantity >= 0),
  unit text not null,
  rate numeric(14,2) not null check (rate >= 0),
  total numeric(14,2) not null check (total >= 0),
  supplier_name text,
  supplier_mobile text,
  bill_number text,
  bill_photo_url text,
  payment_status text not null default 'unpaid' check (payment_status in ('paid', 'partial', 'unpaid')),
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.expenses (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  site_id text references public.sites(id) on delete set null,
  date date not null,
  category text not null check (category in ('labour', 'material', 'transport', 'equipment', 'food', 'site', 'office', 'misc')),
  amount numeric(14,2) not null check (amount >= 0),
  payment_mode text not null check (payment_mode in ('cash', 'upi', 'bank_transfer', 'cheque')),
  notes text,
  receipt_photo_url text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.client_payments (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  site_id text not null references public.sites(id) on delete restrict,
  contract_amount numeric(14,2) not null default 0 check (contract_amount >= 0),
  received_amount numeric(14,2) not null default 0 check (received_amount >= 0),
  pending_amount numeric(14,2) not null default 0 check (pending_amount >= 0),
  payment_date date not null,
  payment_mode text not null check (payment_mode in ('cash', 'upi', 'bank_transfer', 'cheque')),
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.supplier_payments (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  supplier_id text not null references public.suppliers(id) on delete restrict,
  site_id text references public.sites(id) on delete set null,
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  pending_amount numeric(14,2) not null default 0 check (pending_amount >= 0),
  payment_date date not null,
  payment_mode text not null check (payment_mode in ('cash', 'upi', 'bank_transfer', 'cheque')),
  bill_reference text,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.progress_updates (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  site_id text not null references public.sites(id) on delete restrict,
  date date not null,
  title text not null,
  description text not null,
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  ai_summary text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.progress_photos (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  site_id text not null references public.sites(id) on delete restrict,
  progress_update_id text references public.progress_updates(id) on delete cascade,
  photo_url text not null,
  storage_path text not null,
  caption text,
  photo_type text not null default 'during' check (photo_type in ('before', 'during', 'after')),
  taken_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.reminders (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  site_id text references public.sites(id) on delete set null,
  title text not null,
  description text,
  due_date date not null,
  status text not null default 'open' check (status in ('open', 'done', 'snoozed')),
  snoozed_until date,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.notifications (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  title text not null,
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  read_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.activity_logs (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  site_id text references public.sites(id) on delete set null,
  entity_table text not null,
  entity_id text not null,
  action text not null check (action in ('create', 'update', 'delete', 'archive', 'sync', 'ai_confirm')),
  description text not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.audit_logs (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  entity_table text not null,
  entity_id text not null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.offline_sync_queue (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  operation_type text not null check (operation_type in ('insert', 'update', 'delete', 'upload')),
  table_name text not null,
  record_id text not null,
  payload jsonb not null,
  retry_count integer not null default 0 check (retry_count >= 0),
  last_error text,
  synced_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'offline_sync' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'pending' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.ai_conversations (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  title text not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'ai' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.ai_messages (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  conversation_id text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  structured_json jsonb,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  confirmed_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'ai' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.ai_memories (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  site_id text references public.sites(id) on delete set null,
  memory_type text not null,
  title text not null,
  content text not null,
  source_record_table text,
  source_record_id text,
  embedding vector(1536),
  importance integer not null default 5 check (importance between 1 and 10),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'ai' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.ai_memory_links (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  memory_id text not null references public.ai_memories(id) on delete cascade,
  entity_table text not null,
  entity_id text not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'ai' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.smart_suggestions (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  site_id text references public.sites(id) on delete set null,
  title text not null,
  description text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'dismissed', 'done')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'ai' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.user_preferences (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  unique (company_id, user_id, key)
);

create table if not exists public.data_health_checks (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  site_id text references public.sites(id) on delete set null,
  check_type text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  message text not null,
  entity_table text,
  entity_id text,
  resolved_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz
);

create unique index if not exists attendance_one_per_day
  on public.attendance(company_id, site_id, labour_id, date)
  where deleted_at is null and archived = false;

create unique index if not exists materials_unique_bill
  on public.materials(company_id, bill_number)
  where bill_number is not null and deleted_at is null and archived = false;

create index if not exists sites_company_status_idx on public.sites(company_id, status, archived);
create index if not exists attendance_company_date_idx on public.attendance(company_id, date, site_id);
create index if not exists materials_company_date_idx on public.materials(company_id, date, site_id);
create index if not exists expenses_company_date_idx on public.expenses(company_id, date, site_id);
create index if not exists client_payments_company_site_idx on public.client_payments(company_id, site_id, payment_date);
create index if not exists supplier_payments_company_supplier_idx on public.supplier_payments(company_id, supplier_id, payment_date);
create index if not exists ai_memories_company_site_idx on public.ai_memories(company_id, site_id, memory_type);
create index if not exists ai_memories_embedding_idx on public.ai_memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);

do $$
declare
  t text;
begin
  foreach t in array[
    'profiles','companies','company_members','sites','labour','attendance','labour_payments','suppliers','materials','expenses',
    'client_payments','supplier_payments','progress_updates','progress_photos','reminders','notifications','activity_logs','audit_logs',
    'offline_sync_queue','ai_conversations','ai_messages','ai_memories','ai_memory_links','smart_suggestions','user_preferences','data_health_checks'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname in ('public', 'storage')
      and (
        policyname in (
          'profiles read own','profiles write own','companies read member','companies insert owner','companies update admin',
          'company_members select company','company_members insert admin','company_members update admin','company_members delete admin',
          'site photo read company','site photo upload staff','site photo update staff','site photo delete admin'
        )
        or policyname like '% select company'
        or policyname like '% insert staff'
        or policyname like '% update staff'
        or policyname like '% delete admin'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy "profiles read own" on public.profiles for select using (id = auth.uid());
create policy "profiles write own" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy "companies read member" on public.companies for select using (id in (select company_id from public.user_company_ids()) or owner_id = auth.uid());
create policy "companies insert owner" on public.companies for insert with check (owner_id = auth.uid());
create policy "companies update admin" on public.companies for update using (public.is_company_admin(id) or owner_id = auth.uid()) with check (public.is_company_admin(id) or owner_id = auth.uid());

do $$
declare
  t text;
begin
  foreach t in array[
    'sites','labour','attendance','labour_payments','suppliers','materials','expenses','client_payments','supplier_payments',
    'progress_updates','progress_photos','reminders','notifications','activity_logs','audit_logs','offline_sync_queue',
    'ai_conversations','ai_messages','ai_memories','ai_memory_links','smart_suggestions','user_preferences','data_health_checks'
  ]
  loop
    execute format('create policy %I on public.%I for select using (company_id in (select company_id from public.user_company_ids()))', t || ' select company', t);
    execute format('create policy %I on public.%I for insert with check (public.can_write_company(company_id))', t || ' insert staff', t);
    execute format('create policy %I on public.%I for update using (public.can_write_company(company_id)) with check (public.can_write_company(company_id))', t || ' update staff', t);
    execute format('create policy %I on public.%I for delete using (public.is_company_admin(company_id))', t || ' delete admin', t);
  end loop;
end $$;

create policy "company_members select company" on public.company_members for select using (company_id in (select company_id from public.user_company_ids()));
create policy "company_members insert admin" on public.company_members for insert with check (
  public.is_company_admin(company_id)
  or (
    user_id = auth.uid()
    and status = 'active'
    and company_id = 'hh-spaces-company'
    and lower(email) = lower(auth.jwt() ->> 'email')
    and lower(email) in ('arbaz123@hhspaces.app', 'sahil123@hhspaces.app')
  )
  or (
    user_id = auth.uid()
    and status = 'active'
    and exists (
      select 1
      from public.companies c
      where c.id = company_id
        and c.owner_id = auth.uid()
    )
  )
);
create policy "company_members update admin" on public.company_members for update using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));
create policy "company_members delete admin" on public.company_members for delete using (public.is_company_admin(company_id));

insert into storage.buckets (id, name, public)
values ('site-photos', 'site-photos', false),
       ('company-assets', 'company-assets', false)
on conflict (id) do nothing;

create policy "site photo read company" on storage.objects
for select using (
  bucket_id in ('site-photos', 'company-assets')
  and split_part(name, '/', 1) in (select company_id from public.user_company_ids())
);

create policy "site photo upload staff" on storage.objects
for insert with check (
  bucket_id in ('site-photos', 'company-assets')
  and split_part(name, '/', 1) in (select company_id from public.user_company_ids())
  and public.can_write_company(split_part(name, '/', 1))
);

create policy "site photo update staff" on storage.objects
for update using (
  bucket_id in ('site-photos', 'company-assets')
  and split_part(name, '/', 1) in (select company_id from public.user_company_ids())
  and public.can_write_company(split_part(name, '/', 1))
);

create policy "site photo delete admin" on storage.objects
for delete using (
  bucket_id in ('site-photos', 'company-assets')
  and public.is_company_admin(split_part(name, '/', 1))
);
