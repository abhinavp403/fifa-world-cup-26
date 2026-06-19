---
name: wc-analytics-audit
description: >
  Audit the FIFA World Cup 2026 project's analytics data integrity. Use when the
  user wants to verify or audit match/player/team stats, check squads against real
  match lineups, find "squad replacements" / injury swaps, detect stale or missing
  stats in the team-comparison full table, or confirm the stats cache is consistent.
  Triggers: "audit analytics", "check the stats", "any squad replacements", "why is
  X not showing stats", "verify the data", "is the cache stale".
---

# WC Analytics Audit

Three independent checks over the project's Supabase data + the live Sofascore /
Wikipedia sources. Run whichever the user asked about; run all three for a full audit.

**Prereqs:** run from the project root. Requires `.env.local` with
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RAPID_API_KEY`. The scripts
read `.env.local` directly and resolve `@supabase/supabase-js` from the project's
`node_modules`, so no build step is needed.

## 1. Roster ↔ lineup integrity (existing script)

Cross-references every finished match's real Sofascore lineup against the DB roster.
Surfaces players who played but aren't in our squad (`unmatched`), photo-id mismatches,
and players who played but still show zero stats.

```
node --conditions=react-server --env-file=.env.local --import tsx scripts/audit-analytics.ts
```

- **`unmatched` players** usually mean a squad replacement we're missing, OR a name/photo
  mismatch. A *clean* result does NOT prove there are no replacements — it only sees
  players who have logged minutes (see check 3 for the blind spot).

## 2. Stale / missing stats cache

Scans `fixture_stats` (per-fixture raw cache) and `team_stats` for rows that are missing
the expanded team-stat fields, or that have `matches > 0` but all-zero new stats. This is
how "some teams show blank stats in the full table" bugs are found — a fixture ingested by
older code (or before Sofascore finished populating stats) keeps a stale snapshot, because
the incremental sync never re-fetches an already-cached fixture.

```
node .claude/skills/wc-analytics-audit/scripts/stale-cache-check.mjs
```

**Remediation** (only for the flagged fixture ids): delete those rows and re-sync.
```
# delete the stale fixture_stats rows (use the ids the script printed), then:
npm run sync:stats
```
The script prints a ready-to-paste snippet for deleting specific ids.

## 3. Squad replacement sweep (the audit blind spot)

Fetches the authoritative Wikipedia "2026 FIFA World Cup squads" page, extracts every
"withdrew injured … replaced by …" note per team, and cross-references our DB roster to
report which replacements we're still missing. Catches pre-tournament / non-playing
replacements that check 1 cannot see.

```
node .claude/skills/wc-analytics-audit/scripts/squad-replacements.mjs
```

For each `⚠️ MISSING` team, apply the swap. Prefer a targeted edit when the outgoing
player is present in `src/lib/squads.ts` (replace just that one line, keep the verified
photo), then `npm run migrate:squads`. Use the full rebuild only when the outgoing player
isn't in our data:
```
npm run sync:roster -- --codes <CODE>          # dry run, preview
npm run sync:roster -- --codes <CODE> --write  # rewrite that team in squads.ts
npm run migrate:squads                         # push to the DB
```
Note: `sync:roster` reconciles the *whole* team to the confirmed squad, so it may also
"change" players that are really just transliteration/spelling variants of the same person
(e.g. "Khozhiakbar Alizhonov" → "Khojiakbar Alijonov"). Those are cosmetic, not real swaps
— don't treat them as necessary. The dry run only lists additions, not removals, so a
migrate may prune more than it shows.

## Interpreting results

- All three clean → analytics data is consistent.
- Report findings as a short table (team, issue, fix), then ask before mutating data.
- Data fixes (re-sync, roster swap, migrate) write to the production Supabase DB — confirm
  with the user before running the remediation steps unless they've already asked for it.
