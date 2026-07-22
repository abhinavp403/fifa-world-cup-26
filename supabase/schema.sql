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

-- Per-fixture stats cache: one row per finished Sofascore fixture, holding its
-- raw (un-finalized) per-player and per-team contributions. The stats sync
-- INGESTS each finished fixture exactly once (the expensive API calls), then
-- AGGREGATES the whole tournament by summing these cached rows in the DB
-- (cheap, no API calls). `data` shape: { players: [...], teams: { CODE: {...} } }.
-- Written only with the service_role key.
create table if not exists public.fixture_stats (
  fixture_id  bigint primary key,            -- Sofascore event id
  home_code   text,
  away_code   text,
  data        jsonb not null,
  synced_at   timestamptz not null default now()
);

alter table public.fixture_stats enable row level security;
-- No public read policy: only the sync (service_role key) touches this table.

-- Durable snapshots of the full per-match analytics payload (lineups, events,
-- momentum, stats, ratings). The match route serves these first for finished
-- fixtures, so analytics keep working — and cost no live API calls — even after
-- the Sofascore (RapidAPI) subscription lapses. Written with the service key.
create table if not exists public.match_analytics (
  fixture_id bigint primary key,   -- Sofascore event id
  payload    jsonb not null,
  synced_at  timestamptz not null default now()
);

alter table public.match_analytics enable row level security;
-- No public read policy: only the match route (service_role key) touches this.

-- Durable snapshot of the whole /api/worldcup payload (group standings, resolved
-- bracket, champion, attached fixtureIds + stadiums, team stats). A single row.
-- The worldcup route refreshes it on every healthy request and serves it when
-- the live feeds (football-data.org / Sofascore) are gone, so results, the
-- bracket, host-city fixtures and match-analytics links all survive the APIs
-- being cancelled. Written with the service key.
create table if not exists public.worldcup_snapshot (
  id         int primary key default 1,   -- always 1 (single row)
  payload    jsonb not null,
  synced_at  timestamptz not null default now()
);

alter table public.worldcup_snapshot enable row level security;
-- No public read policy: only the worldcup route (service_role key) touches this.

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
