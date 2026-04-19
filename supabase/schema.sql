-- ═══════════════════════════════════════════════════════════
-- Lion Admin — Supabase Schema
-- Cole este SQL no SQL Editor do Supabase e execute.
-- Cada tabela usa id + user_id + data (JSONB) para evitar
-- incompatibilidade de nomes camelCase ↔ snake_case.
-- RLS garante isolamento total por usuário.
-- ═══════════════════════════════════════════════════════════

-- ─── Transactions (lion-txs) ──────────────────────────────
create table if not exists public.transactions (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.transactions enable row level security;
drop policy if exists "own_transactions" on public.transactions;
create policy "own_transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Goals (lion-goals) ───────────────────────────────────
create table if not exists public.goals (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.goals enable row level security;
drop policy if exists "own_goals" on public.goals;
create policy "own_goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Rentals (lion-rentals) ───────────────────────────────
create table if not exists public.rentals (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.rentals enable row level security;
drop policy if exists "own_rentals" on public.rentals;
create policy "own_rentals" on public.rentals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Maintenance (lion-maintenance) ───────────────────────
create table if not exists public.maintenance_items (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.maintenance_items enable row level security;
drop policy if exists "own_maintenance" on public.maintenance_items;
create policy "own_maintenance" on public.maintenance_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Vehicles (lion-vehicles) ─────────────────────────────
create table if not exists public.vehicles (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.vehicles enable row level security;
drop policy if exists "own_vehicles" on public.vehicles;
create policy "own_vehicles" on public.vehicles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Revisions (lion-revisions) ───────────────────────────
create table if not exists public.revisions (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.revisions enable row level security;
drop policy if exists "own_revisions" on public.revisions;
create policy "own_revisions" on public.revisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Calendar Events (lion-calendar) ──────────────────────
create table if not exists public.calendar_events (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.calendar_events enable row level security;
drop policy if exists "own_calendar" on public.calendar_events;
create policy "own_calendar" on public.calendar_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Trips (lion-trips) ───────────────────────────────────
create table if not exists public.trips (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.trips enable row level security;
drop policy if exists "own_trips" on public.trips;
create policy "own_trips" on public.trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Family Members (lion-family) ─────────────────────────
create table if not exists public.family_members (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.family_members enable row level security;
drop policy if exists "own_family" on public.family_members;
create policy "own_family" on public.family_members
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Collectors (lion-collectors) ─────────────────────────
create table if not exists public.collectors (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.collectors enable row level security;
drop policy if exists "own_collectors" on public.collectors;
create policy "own_collectors" on public.collectors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Bills (lion-bills) ───────────────────────────────────
create table if not exists public.bills (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.bills enable row level security;
drop policy if exists "own_bills" on public.bills;
create policy "own_bills" on public.bills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Folders / Notepad (np-folders) ──────────────────────
create table if not exists public.folders (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.folders enable row level security;
drop policy if exists "own_folders" on public.folders;
create policy "own_folders" on public.folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Documents metadata (lion-docs-meta) ──────────────────
create table if not exists public.documents (
  id         text        primary key,
  user_id    uuid        references auth.users(id) on delete cascade not null,
  data       jsonb       not null default '{}',
  created_at timestamptz default now()
);
alter table public.documents enable row level security;
drop policy if exists "own_documents" on public.documents;
create policy "own_documents" on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
