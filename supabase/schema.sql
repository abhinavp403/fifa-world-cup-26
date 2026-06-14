-- ─────────────────────────────────────────────────────────────────────────────
-- FIFA World Cup 2026 dashboard — squad data schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

-- Teams: one row per qualified nation (keyed by the 3-letter code used app-wide).
create table if not exists public.teams (
  code        text primary key,                 -- e.g. "BRA", "ENG"
  coach       text not null,
  updated_at  timestamptz not null default now()
);

-- Players: 26 per team. `photo` stores the already-resolved image URL
-- (the app's s()/p() helpers just produce strings, so we store the string).
-- `stats` is reserved for the live tournament-stats pipeline (JSONB, nullable);
-- until matches begin the app falls back to ZERO_STATS.
create table if not exists public.players (
  id          bigint generated always as identity primary key,
  team_code   text not null references public.teams(code) on delete cascade,
  name        text not null,
  number      int  not null,
  position    text not null check (position in ('GK','DEF','MID','FWD')),
  club        text not null,
  age         int  not null,
  captain     boolean not null default false,
  photo       text,
  stats       jsonb,
  updated_at  timestamptz not null default now(),
  -- natural key so the migration/agent can UPSERT idempotently
  unique (team_code, name)
);

create index if not exists players_team_code_idx on public.players (team_code);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Squad data is public, so allow anonymous READ. Writes are done only with the
-- service_role key (migration script / squad-update agent), which bypasses RLS.
alter table public.teams   enable row level security;
alter table public.players enable row level security;

drop policy if exists "public read teams"   on public.teams;
drop policy if exists "public read players" on public.players;

create policy "public read teams"   on public.teams   for select using (true);
create policy "public read players" on public.players for select using (true);

-- Man of the Match: one row per match, keyed by team names as returned by FIFA.
-- Populated by `npm run sync:motm` (local Chrome headless scraper).
create table if not exists public.match_motm (
  id          bigint generated always as identity primary key,
  home_team   text not null,
  away_team   text not null,
  player_name text not null,
  player_team text not null,
  updated_at  timestamptz not null default now(),
  unique (home_team, away_team)
);

alter table public.match_motm enable row level security;
drop policy if exists "public read match_motm" on public.match_motm;
create policy "public read match_motm" on public.match_motm for select using (true);
drop trigger if exists match_motm_touch on public.match_motm;
create trigger match_motm_touch before update on public.match_motm for each row execute function public.touch_updated_at();

-- keep updated_at fresh on any write
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists teams_touch   on public.teams;
drop trigger if exists players_touch on public.players;
create trigger teams_touch   before update on public.teams   for each row execute function public.touch_updated_at();
create trigger players_touch before update on public.players for each row execute function public.touch_updated_at();
