# FIFA World Cup 2026 Dashboard

A real-time dashboard for the FIFA World Cup 2026 — live group standings, a dynamic knockout bracket, deep match analytics, per-player stat sheets, head-to-head team comparison, squad rosters, and host-city information.

**🔗 Live site: [fifa-world-cup-26-nu.vercel.app](https://fifa-world-cup-26-nu.vercel.app/)**

## Features

### Tournament
- **Live group standings** — all 12 groups with FIFA tiebreak rules (points → goal difference → goals for) and a goal-difference column
- **Dynamic knockout bracket** — R32 → R16 → QF → SF → Final, auto-populating with qualifying teams as results come in
- **Today's / upcoming fixtures** — clickable to open full match analytics
- **Team search & filtering** — accent-insensitive search and confederation filters (UEFA, CONMEBOL, CONCACAF, AFC, CAF, OFC) that narrow the standings to the matching teams
- **Host cities & venues** — all 16 host cities across the USA, Canada, and Mexico
- **Expand/collapse all matches** toggle, and five selectable colour themes

### Match analytics (per match)
- **Team stat comparison** — possession, shots, passing, key passes, tackles, cards and more
- **Lineups & formations** for both sides, with per-player ratings
- **Key moments timeline** — goals, cards, and substitutions
- **Match momentum** — Sofascore attack-pressure graph rendered as smooth waves or per-minute bars, with goal markers
- **Man of the Match** — scraped from FIFA's official award article
- **Highlights** link per match

### Players & teams
- **Player stat sheets** — position-aware breakdowns (overview, defensive, passing, attacking, discipline; goalkeeping for GKs) with averages and per-90 context
- **Head-to-head team comparison** — cumulative-totals and per-game charts plus a full stat table including xG, clearances, crosses, shots inside/outside box, touches in the box, and duel/tackle/dribble percentages
- **Squad rosters** — 26 players per nation with photos, kept in sync with confirmed squads and injury replacements

## Tech stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Database**: Supabase (Postgres) — squad rosters, aggregated player/team stats, Man-of-the-Match, and a per-fixture stats cache
- **Data sources**:
  - **sportapi7 (Sofascore via RapidAPI)** — live per-match stats, lineups, player/team statistics, and momentum
  - **football-data.org** — fixtures and results used to derive standings and the bracket
  - **FIFA CXM article API** — official Man-of-the-Match winners
- **Deployment**: Vercel

## How it works

### Standings & bracket
`GET /api/worldcup` fetches the match feed, computes group standings in real time using FIFA's tiebreak rules (points → goal difference → goals for), and resolves knockout slots with real teams as matches complete. Static fallback data keeps the page rendering before the draw/results are available.

### Match analytics
`GET /api/match` assembles a per-match payload live from Sofascore — team stats, lineups, incidents (the events timeline), per-player ratings, the momentum graph, and the FIFA-sourced Man of the Match. Responses are cached for 5 minutes (ISR).

### Incremental stats pipeline
Whole-tournament player and team aggregates are too expensive to compute per request, so they're pre-aggregated into Supabase:

1. **Ingest** — each *newly finished* fixture is fetched once and its raw per-player and per-team contributions are cached in `fixture_stats` (the expensive, API-bound step happens exactly once per match).
2. **Aggregate** — the cached rows are summed in the database (no API calls) and written to `players.stats` and `team_stats`.

The sync runs on a **daily Vercel cron**, and is also triggered **opportunistically** (non-blocking) the first time a freshly finished match is opened — so dashboards catch up within minutes without waiting for the next cron. The Sofascore client retries on rate limits so bursts don't drop fixtures.

### Man of the Match
`syncMotm` reads FIFA's official "Superior Player of the Match" article via the CXM API, parses each match's winner, and stores it in `match_motm`. Matches are resolved by FIFA team code so naming differences don't break the lookup.

## Project structure

```
src/
├── app/api/
│   ├── worldcup/route.ts        # Standings + bracket
│   ├── match/route.ts           # Per-match analytics (live from Sofascore)
│   └── cron/sync-stats/route.ts # Daily incremental stats sync
├── components/
│   ├── WorldCupDashboard.tsx    # Main dashboard (groups, fixtures, nav)
│   ├── KnockoutBracket.tsx      # Bracket visualisation
│   ├── MatchAnalytics.tsx       # Match modal (stats, lineups, momentum, MOTM)
│   ├── PlayerDashboard.tsx      # Per-player stat sheet
│   ├── TeamComparison.tsx       # Head-to-head comparison
│   └── TeamStatsModal.tsx       # Cumulative / per-game charts + full table
└── lib/
    ├── sportApi7.ts             # Sofascore (sportapi7) client
    ├── statsSync.ts             # Incremental ingest + aggregate
    ├── teamFixtureStats.ts      # Per-fixture team-stat aggregation
    ├── motmSync.ts              # FIFA Man-of-the-Match scraper
    ├── footballData.ts          # football-data.org client
    ├── resolver.ts              # Standings + bracket resolution
    ├── squads.ts                # Squad rosters
    └── flags.ts                 # Team codes ↔ flags
supabase/schema.sql              # Teams, players, team_stats, match_motm, fixture_stats
scripts/                         # Roster + stats sync utilities
.claude/skills/wc-analytics-audit # Data-integrity audit skill
```

## Tournament details

- **Dates**: June 11 – July 19, 2026
- **Format**: 48 teams, 12 groups (A–L), 104 matches + a third-place match
- **Hosts**: USA, Canada, Mexico — 16 host cities

## License

MIT
