-- ═══════════════════════════════════════════════════════════
-- Lion Admin — Supabase Schema (v2 — drop & recreate)
-- Cole este SQL no SQL Editor do Supabase e execute.
-- ═══════════════════════════════════════════════════════════

-- Drop existing tables so we can recreate with correct columns
drop table if exists public.transactions      cascade;
drop table if exists public.goals             cascade;
drop table if exists public.rentals           cascade;
drop table if exists public.maintenance_items cascade;
drop table if exists public.vehicles          cascade;
drop table if exists public.revisions         cascade;
drop table if exists public.calendar_events   cascade;
drop table if exists public.trips             cascade;
drop table if exists public.family_members    cascade;
drop table if exists public.collectors        cascade;
drop table if exists public.bills             cascade;
drop table if exists public.folders           cascade;
drop table if exists public.documents         cascade;

-- ─── Transactions (lion-txs) ──────────────────────────────
create table public.transactions (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.transactions enable row level security;
create policy "own_transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Goals (lion-goals) ───────────────────────────────────
create table public.goals (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.goals enable row level security;
create policy "own_goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Rentals (lion-rentals) ───────────────────────────────
create table public.rentals (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.rentals enable row level security;
create policy "own_rentals" on public.rentals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Maintenance (lion-maintenance) ───────────────────────
create table public.maintenance_items (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.maintenance_items enable row level security;
create policy "own_maintenance" on public.maintenance_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Vehicles (lion-vehicles) ─────────────────────────────
create table public.vehicles (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.vehicles enable row level security;
create policy "own_vehicles" on public.vehicles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Revisions (lion-revisions) ───────────────────────────
create table public.revisions (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.revisions enable row level security;
create policy "own_revisions" on public.revisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Calendar Events (lion-calendar) ──────────────────────
create table public.calendar_events (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.calendar_events enable row level security;
create policy "own_calendar" on public.calendar_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Trips (lion-trips) ───────────────────────────────────
create table public.trips (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.trips enable row level security;
create policy "own_trips" on public.trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Family Members (lion-family) ─────────────────────────
create table public.family_members (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.family_members enable row level security;
create policy "own_family" on public.family_members
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Collectors (lion-collectors) ─────────────────────────
create table public.collectors (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.collectors enable row level security;
create policy "own_collectors" on public.collectors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Bills (lion-bills) ───────────────────────────────────
create table public.bills (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.bills enable row level security;
create policy "own_bills" on public.bills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Folders / Notepad (np-folders) ──────────────────────
create table public.folders (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.folders enable row level security;
create policy "own_folders" on public.folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Documents metadata (lion-docs-meta) ──────────────────
create table public.documents (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.documents enable row level security;
create policy "own_documents" on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Imóveis (lion-imoveis) ───────────────────────────────
create table public.imoveis (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.imoveis enable row level security;
create policy "own_imoveis" on public.imoveis
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Produtos / Bens (lion-produtos) ─────────────────────
create table public.produtos (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.produtos enable row level security;
create policy "own_produtos" on public.produtos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Terra Fazendas (lion-terra) ──────────────────────────
create table public.terra_fazendas (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.terra_fazendas enable row level security;
create policy "own_terra_fazendas" on public.terra_fazendas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public_read_terra_fazendas" on public.terra_fazendas
  for select using (true);

-- ─── Terra Talhões (lion-talhoes) ─────────────────────────
create table public.terra_talhoes (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.terra_talhoes enable row level security;
create policy "own_terra_talhoes" on public.terra_talhoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public_read_terra_talhoes" on public.terra_talhoes
  for select using (true);

-- ─── Indexes on user_id for all tables ───────────────────
create index idx_transactions_user    on public.transactions(user_id);
create index idx_goals_user           on public.goals(user_id);
create index idx_rentals_user         on public.rentals(user_id);
create index idx_maintenance_user     on public.maintenance_items(user_id);
create index idx_vehicles_user        on public.vehicles(user_id);
create index idx_revisions_user       on public.revisions(user_id);
create index idx_calendar_events_user on public.calendar_events(user_id);
create index idx_trips_user           on public.trips(user_id);
create index idx_family_members_user  on public.family_members(user_id);
create index idx_collectors_user      on public.collectors(user_id);
create index idx_bills_user           on public.bills(user_id);
create index idx_folders_user         on public.folders(user_id);
create index idx_documents_user       on public.documents(user_id);
create index idx_imoveis_user         on public.imoveis(user_id);
create index idx_produtos_user        on public.produtos(user_id);
create index idx_terra_fazendas_user  on public.terra_fazendas(user_id);
create index idx_terra_talhoes_user   on public.terra_talhoes(user_id);
