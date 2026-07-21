-- H&H SPACES Rate Analyzer module schema.
-- Non-destructive: creates tables/policies only when missing.
-- Run this in Supabase SQL Editor after the main supabase/schema.sql is already applied.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.work_categories (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  name text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint work_categories_company_org_match check (organization_id = company_id),
  unique (company_id, lower(name))
);

create table if not exists public.work_subcategories (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  category_id text not null references public.work_categories(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint work_subcategories_company_org_match check (organization_id = company_id),
  unique (company_id, category_id, lower(name))
);

create table if not exists public.rate_items (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  category_id text references public.work_categories(id) on delete set null,
  subcategory_id text references public.work_subcategories(id) on delete set null,
  work_name text not null,
  detailed_specification text,
  common_alternative_names text[] not null default '{}',
  unit text not null,
  measurement_formula text not null default 'Measured actual finished quantity',
  material_consumption_formula text,
  rate_matrix jsonb not null default '{}'::jsonb,
  minimum_charge numeric(14,2) not null default 0 check (minimum_charge >= 0),
  worker_productivity_per_day numeric(14,3) not null default 1 check (worker_productivity_per_day > 0),
  skilled_workers_required numeric(8,2) not null default 1 check (skilled_workers_required >= 0),
  helpers_required numeric(8,2) not null default 0 check (helpers_required >= 0),
  machine_required text,
  material_wastage_percentage numeric(6,2) not null default 0 check (material_wastage_percentage >= 0),
  supervision_percentage numeric(6,2) not null default 0 check (supervision_percentage >= 0),
  contractor_overhead_percentage numeric(6,2) not null default 0 check (contractor_overhead_percentage >= 0),
  profit_percentage numeric(6,2) not null default 0 check (profit_percentage >= 0),
  gst_percentage numeric(6,2) not null default 18 check (gst_percentage >= 0),
  city text,
  area_or_locality text,
  brand text,
  quality_grade text,
  notes text,
  exclusions text[] not null default '{}',
  warranty text,
  work_sequence text[] not null default '{}',
  quality_checklist text[] not null default '{}',
  common_mistakes text[] not null default '{}',
  required_tools text[] not null default '{}',
  completion_time text,
  rate_validity_date date,
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint rate_items_company_org_match check (organization_id = company_id)
);

create table if not exists public.rate_history (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  rate_item_id text not null references public.rate_items(id) on delete cascade,
  previous_rate numeric(14,2) check (previous_rate is null or previous_rate >= 0),
  current_rate numeric(14,2) not null check (current_rate >= 0),
  difference_amount numeric(14,2) not null default 0,
  difference_percentage numeric(8,3) not null default 0,
  source_name text,
  supplier_name text,
  update_note text,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint rate_history_company_org_match check (organization_id = company_id)
);

create table if not exists public.material_rates (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  material_name text not null,
  category text,
  unit text not null,
  brand text,
  quality_grade text,
  low_rate numeric(14,2) not null default 0 check (low_rate >= 0),
  standard_rate numeric(14,2) not null default 0 check (standard_rate >= 0),
  premium_rate numeric(14,2) not null default 0 check (premium_rate >= 0),
  supplier_id text references public.suppliers(id) on delete set null,
  supplier_name text,
  city text,
  area_or_locality text,
  updated_on date not null default current_date,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint material_rates_company_org_match check (organization_id = company_id)
);

create table if not exists public.labour_rates (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  trade_name text not null,
  unit text not null default 'day',
  low_rate numeric(14,2) not null default 0 check (low_rate >= 0),
  standard_rate numeric(14,2) not null default 0 check (standard_rate >= 0),
  premium_rate numeric(14,2) not null default 0 check (premium_rate >= 0),
  productivity_per_day numeric(14,3) not null default 1 check (productivity_per_day > 0),
  city text,
  area_or_locality text,
  updated_on date not null default current_date,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint labour_rates_company_org_match check (organization_id = company_id)
);

create table if not exists public.city_rates (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  city text not null,
  area_or_locality text,
  market_name text,
  multiplier numeric(8,4) not null default 1 check (multiplier > 0),
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint city_rates_company_org_match check (organization_id = company_id),
  unique (company_id, lower(city), lower(coalesce(area_or_locality, '')))
);

create table if not exists public.supplier_rates (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  supplier_id text references public.suppliers(id) on delete set null,
  material_rate_id text references public.material_rates(id) on delete set null,
  rate_item_id text references public.rate_items(id) on delete set null,
  quoted_rate numeric(14,2) not null default 0 check (quoted_rate >= 0),
  credit_days integer not null default 0 check (credit_days >= 0),
  delivery_days integer not null default 0 check (delivery_days >= 0),
  minimum_order text,
  transport_charge numeric(14,2) not null default 0 check (transport_charge >= 0),
  reliability_score integer not null default 5 check (reliability_score between 1 and 10),
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint supplier_rates_company_org_match check (organization_id = company_id)
);

create table if not exists public.productivity_rates (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  rate_item_id text references public.rate_items(id) on delete cascade,
  trade_name text not null,
  unit text not null,
  productivity_per_day numeric(14,3) not null check (productivity_per_day > 0),
  skilled_workers numeric(8,2) not null default 1 check (skilled_workers >= 0),
  helpers numeric(8,2) not null default 0 check (helpers >= 0),
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint productivity_rates_company_org_match check (organization_id = company_id)
);

create table if not exists public.site_multipliers (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  condition_key text not null,
  condition_label text not null,
  multiplier_percent numeric(8,3) not null default 0,
  reason text,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint site_multipliers_company_org_match check (organization_id = company_id)
);

create table if not exists public.minimum_charge_rules (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  rule_name text not null,
  applies_to_category text,
  applies_to_rate_item_id text references public.rate_items(id) on delete set null,
  minimum_quantity numeric(14,3) not null default 0 check (minimum_quantity >= 0),
  minimum_charge numeric(14,2) not null default 0 check (minimum_charge >= 0),
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint minimum_charge_rules_company_org_match check (organization_id = company_id)
);

create table if not exists public.custom_formulas (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  formula_name text not null,
  variables jsonb not null default '[]'::jsonb,
  expression jsonb not null default '{}'::jsonb,
  output_unit text,
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint custom_formulas_company_org_match check (organization_id = company_id)
);

create table if not exists public.rate_templates (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  template_name text not null,
  description text,
  template_type text not null default 'estimate' check (template_type in ('estimate', 'boq', 'quotation', 'invoice', 'purchase_list')),
  items jsonb not null default '[]'::jsonb,
  is_favourite boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint rate_templates_company_org_match check (organization_id = company_id)
);

create table if not exists public.rate_analyses (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  project_name text,
  client_name text,
  site_location text,
  city text,
  pin_code text,
  work_category text,
  work_subcategory text,
  contract_type text,
  measurement_unit text,
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  total_contractor_cost numeric(14,2) not null default 0 check (total_contractor_cost >= 0),
  recommended_selling_price numeric(14,2) not null default 0 check (recommended_selling_price >= 0),
  premium_selling_price numeric(14,2) not null default 0 check (premium_selling_price >= 0),
  profit_percentage numeric(8,3) not null default 0,
  gst_percentage numeric(8,3) not null default 18,
  final_customer_amount numeric(14,2) not null default 0 check (final_customer_amount >= 0),
  condition_multipliers jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  ai_original_text text,
  ai_structured_json jsonb,
  ai_confidence numeric(5,4) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent', 'won', 'lost', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint rate_analyses_company_org_match check (organization_id = company_id)
);

create table if not exists public.rate_analysis_items (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  rate_analysis_id text not null references public.rate_analyses(id) on delete cascade,
  rate_item_id text references public.rate_items(id) on delete set null,
  item_number integer not null default 1,
  description text not null,
  specification text,
  unit text not null,
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  labour_rate numeric(14,2) not null default 0 check (labour_rate >= 0),
  material_rate numeric(14,2) not null default 0 check (material_rate >= 0),
  combined_rate numeric(14,2) not null default 0 check (combined_rate >= 0),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  tax_percentage numeric(8,3) not null default 18,
  total numeric(14,2) not null default 0 check (total >= 0),
  internal_notes text,
  client_notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint rate_analysis_items_company_org_match check (organization_id = company_id)
);

create table if not exists public.material_analysis_items (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  rate_analysis_id text not null references public.rate_analyses(id) on delete cascade,
  material_name text not null,
  brand text,
  specification text,
  unit text not null,
  required_quantity numeric(14,3) not null default 0 check (required_quantity >= 0),
  wastage_percentage numeric(8,3) not null default 0 check (wastage_percentage >= 0),
  purchase_rate numeric(14,2) not null default 0 check (purchase_rate >= 0),
  transport_cost numeric(14,2) not null default 0 check (transport_cost >= 0),
  loading_charge numeric(14,2) not null default 0 check (loading_charge >= 0),
  unloading_charge numeric(14,2) not null default 0 check (unloading_charge >= 0),
  total_material_amount numeric(14,2) not null default 0 check (total_material_amount >= 0),
  supplier_id text references public.suppliers(id) on delete set null,
  supplier_name text,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint material_analysis_items_company_org_match check (organization_id = company_id)
);

create table if not exists public.labour_analysis_items (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  rate_analysis_id text not null references public.rate_analyses(id) on delete cascade,
  trade_name text not null,
  labour_count numeric(10,2) not null default 0 check (labour_count >= 0),
  daily_wage numeric(14,2) not null default 0 check (daily_wage >= 0),
  working_days numeric(10,2) not null default 0 check (working_days >= 0),
  productivity numeric(14,3) not null default 0 check (productivity >= 0),
  overtime_amount numeric(14,2) not null default 0 check (overtime_amount >= 0),
  allowance_amount numeric(14,2) not null default 0 check (allowance_amount >= 0),
  total_labour_amount numeric(14,2) not null default 0 check (total_labour_amount >= 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint labour_analysis_items_company_org_match check (organization_id = company_id)
);

create table if not exists public.additional_charges (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  rate_analysis_id text references public.rate_analyses(id) on delete cascade,
  charge_name text not null,
  charge_type text not null default 'fixed' check (charge_type in ('fixed', 'percentage', 'per_unit')),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint additional_charges_company_org_match check (organization_id = company_id)
);

create table if not exists public.quotation_links (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  rate_analysis_id text references public.rate_analyses(id) on delete cascade,
  quotation_id text,
  public_token_hash text,
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint quotation_links_company_org_match check (organization_id = company_id)
);

create table if not exists public.boq_links (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  rate_analysis_id text references public.rate_analyses(id) on delete cascade,
  boq_reference text,
  grouped_by text check (grouped_by is null or grouped_by in ('room', 'floor', 'category', 'work_phase', 'contractor', 'supplier')),
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint boq_links_company_org_match check (organization_id = company_id)
);

create table if not exists public.estimate_actual_variance (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  rate_analysis_id text references public.rate_analyses(id) on delete cascade,
  estimated_material numeric(14,2) not null default 0 check (estimated_material >= 0),
  actual_material numeric(14,2) not null default 0 check (actual_material >= 0),
  estimated_labour numeric(14,2) not null default 0 check (estimated_labour >= 0),
  actual_labour numeric(14,2) not null default 0 check (actual_labour >= 0),
  estimated_days numeric(10,2) not null default 0 check (estimated_days >= 0),
  actual_days numeric(10,2) not null default 0 check (actual_days >= 0),
  estimated_profit numeric(14,2) not null default 0,
  actual_profit numeric(14,2) not null default 0,
  variance_reason text,
  status text not null default 'active' check (status in ('active', 'reviewed', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint estimate_actual_variance_company_org_match check (organization_id = company_id)
);

create table if not exists public.favourites (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  organization_id text not null,
  project_id text references public.sites(id) on delete set null,
  entity_table text not null,
  entity_id text not null,
  label text,
  status text not null default 'active' check (status in ('active', 'archived')),
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'ai', 'voice', 'offline_sync', 'import')),
  sync_status text not null default 'synced' check (sync_status in ('synced', 'pending', 'failed', 'conflict')),
  idempotency_key text not null unique,
  archived boolean not null default false,
  deleted_at timestamptz,
  constraint favourites_company_org_match check (organization_id = company_id),
  unique (company_id, entity_table, entity_id, created_by)
);

create index if not exists rate_items_company_category_idx on public.rate_items(company_id, category_id, subcategory_id, status, is_active);
create index if not exists rate_items_company_work_idx on public.rate_items(company_id, lower(work_name));
create index if not exists rate_history_company_item_idx on public.rate_history(company_id, rate_item_id, created_at desc);
create index if not exists material_rates_company_name_idx on public.material_rates(company_id, lower(material_name), city);
create index if not exists labour_rates_company_trade_idx on public.labour_rates(company_id, lower(trade_name), city);
create index if not exists rate_analyses_company_project_idx on public.rate_analyses(company_id, project_id, status, created_at desc);
create index if not exists rate_analysis_items_analysis_idx on public.rate_analysis_items(company_id, rate_analysis_id, item_number);
create index if not exists estimate_actual_variance_project_idx on public.estimate_actual_variance(company_id, project_id, rate_analysis_id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'work_categories','work_subcategories','rate_items','rate_history','material_rates','labour_rates','city_rates','supplier_rates','productivity_rates',
    'site_multipliers','minimum_charge_rules','custom_formulas','rate_templates','rate_analyses','rate_analysis_items','material_analysis_items',
    'labour_analysis_items','additional_charges','quotation_links','boq_links','estimate_actual_variance','favourites'
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
    where schemaname = 'public'
      and tablename in (
        'work_categories','work_subcategories','rate_items','rate_history','material_rates','labour_rates','city_rates','supplier_rates','productivity_rates',
        'site_multipliers','minimum_charge_rules','custom_formulas','rate_templates','rate_analyses','rate_analysis_items','material_analysis_items',
        'labour_analysis_items','additional_charges','quotation_links','boq_links','estimate_actual_variance','favourites'
      )
      and (
        policyname like '% select company'
        or policyname like '% insert staff'
        or policyname like '% update staff'
        or policyname like '% delete admin'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'work_categories','work_subcategories','rate_items','rate_history','material_rates','labour_rates','city_rates','supplier_rates','productivity_rates',
    'site_multipliers','minimum_charge_rules','custom_formulas','rate_templates','rate_analyses','rate_analysis_items','material_analysis_items',
    'labour_analysis_items','additional_charges','quotation_links','boq_links','estimate_actual_variance','favourites'
  ]
  loop
    execute format('create policy %I on public.%I for select using (company_id in (select company_id from public.user_company_ids()))', t || ' select company', t);
    execute format('create policy %I on public.%I for insert with check (public.can_write_company(company_id) and organization_id = company_id)', t || ' insert staff', t);
    execute format('create policy %I on public.%I for update using (public.can_write_company(company_id)) with check (public.can_write_company(company_id) and organization_id = company_id)', t || ' update staff', t);
    execute format('create policy %I on public.%I for delete using (public.is_company_admin(company_id))', t || ' delete admin', t);
  end loop;
end $$;
