-- ─────────────────────────────────────────────────────────────────────────────
-- Live stats pipeline — schema additions.
-- Run this once in the Supabase SQL editor AFTER schema.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- Store the api-football player id once we've matched a player, so future
-- syncs are exact (no re-matching by name). Self-healing: the sync fills it in.
alter table public.players
  add column if not exists api_player_id bigint;

create index if not exists players_api_player_id_idx
  on public.players (api_player_id);

-- Per-team aggregated tournament stats (possession, corners, shots, …).
-- The worldcup API reads this instead of hitting api-football on every request.
create table if not exists public.team_stats (
  team_code   text primary key references public.teams(code) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Bookkeeping: when the sync last ran and what it touched.
create table if not exists public.sync_state (
  id            int primary key default 1,
  last_run_at   timestamptz,
  fixtures      int,
  players_set   int,
  players_unmatched int,
  teams_set     int,
  note          text,
  check (id = 1)
);
insert into public.sync_state (id) values (1) on conflict (id) do nothing;

-- sync_state is internal bookkeeping: written only by the sync cron via the
-- service_role key (which bypasses RLS) and never read by the client. Enable
-- RLS with NO policies so anon/authenticated are fully denied.
alter table public.sync_state enable row level security;

-- Public read for team_stats (same as the rest of the public data).
alter table public.team_stats enable row level security;
drop policy if exists "public read team_stats" on public.team_stats;
create policy "public read team_stats" on public.team_stats for select using (true);

drop trigger if exists team_stats_touch on public.team_stats;
create trigger team_stats_touch before update on public.team_stats
  for each row execute function public.touch_updated_at();
