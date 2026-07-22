# HANDOFF — FIFA World Cup 2026 Dashboard

A working guide for AI assistants (and humans) maintaining this project. It captures the
architecture, data pipelines, house conventions, and — most importantly — the hard-won
gotchas that are not obvious from reading the code. Read this fully before making changes.

Live site: https://fifa-world-cup-26-nu.vercel.app/ (Vercel, auto-deploys from `main`).

---

## 1. Owner's working rules (non-negotiable)

1. **NEVER commit or push without being explicitly asked.** The owner says "commit this" /
   "push" when ready, and often dictates exactly how to group changes into separate commits.
   Wait for those instructions. When asked to group commits across one file with multiple
   features, use the temp-file snapshot technique: copy the fully-edited file aside, `git
   checkout` the original, re-apply feature A, commit, restore the full file, commit B.
2. **Do NOT use the Claude preview/browser MCP tools** (`preview_*`). The owner explicitly
   banned them ("dont do claude previews"). Verify with `npx tsc --noEmit`, `npx eslint
   <files>`, and where needed `npm run dev` in the background + `curl` against
   `http://localhost:3000` (kill the server after).
3. **Verification bar for every change:** `npx tsc --noEmit` and `npx eslint <changed files>`
   must pass. WorldCupDashboard.tsx has ~6 pre-existing eslint errors (setState-in-effect
   etc.) — those are baseline, don't fix or worsen them; compare error counts before/after
   if unsure.
4. The owner gives small, iterative UI instructions and frequently reverses them ("undo
   this"). Keep changes surgical so they're easy to revert; everything stays uncommitted
   until they've reviewed it in their own dev server.

## 2. Stack & layout

- **Next.js 16 App Router** + TypeScript + Tailwind v4 + framer-motion + lucide-react.
  Heed `AGENTS.md`: this Next.js version differs from training data — check
  `node_modules/next/dist/docs/` before using unfamiliar APIs.
- **Supabase (Postgres)** — schema in `supabase/schema.sql` (run manually in the Supabase
  SQL editor; there are no migrations). Writes always use `SUPABASE_SERVICE_ROLE_KEY`
  (bypasses RLS); public reads use the anon key. Tables:
  - `teams` (code→coach), `players` (squads + `stats` JSONB per player)
  - `match_motm` — Man of the Match scraped from FIFA (one row per match, team-name keyed)
  - `fixture_stats` — per-fixture raw stat cache (ingest-once), powers incremental sync
  - `match_analytics` — full per-match analytics payload snapshots (durability layer)
- **Key env vars** (in `.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `RAPIDAPI_KEY` (Sofascore/sportapi7), `FOOTBALL_DATA_TOKEN`
  (football-data.org v4), `CRON_SECRET`.

### File map (what lives where)

| Area | Files |
|---|---|
| Main page (client, one big file) | `src/components/WorldCupDashboard.tsx` — hero, countdown, today's matches, groups+standings, host cities, footer; owns modal state |
| Sections | `KnockoutBracket.tsx`, `MatchAnalytics.tsx` (per-match modal), `PlayerDashboard.tsx`, `PlayersSection.tsx`, `TeamComparison.tsx`, `TeamStatsModal.tsx`, `TournamentWrapped.tsx` (Spotify-Wrapped story), `Flag.tsx`, `SiteNav.tsx` |
| API routes | `src/app/api/worldcup/route.ts` (groups/bracket payload, attaches Sofascore fixtureIds), `src/app/api/match/route.ts` (match analytics; snapshot-first), `api/player-photo/[id]` (Sofascore image proxy), cron/sync routes |
| Data libs | `sportApi7.ts` (Sofascore via RapidAPI + 429 retry/backoff), `footballData.ts` (football-data.org), `resolver.ts` (group standings from matches), `bracket.ts` (knockout structure M73–M104), `statsSync.ts` (ingest+aggregate player/team stats), `teamFixtureStats.ts` (team aggregates), `motmSync.ts` (FIFA MOTM scraper parsing), `flags.ts` (FIFA↔ISO2, `FIFA_ARTICLE_TO_CODE`, `S7_NAME_TO_FIFA`), `squads.ts` (static squads + `PlayerStats` type), `squadsData.ts` (DB-or-static squads), `text.ts` (`normalizeText` accent-stripping) |
| Scripts (`package.json`) | `sync:stats`, `sync:motm`, `snapshot:matches`, `migrate:squads`, `sync:roster` — all run as `node --conditions=react-server --env-file=.env.local --import tsx scripts/<x>.ts` |
| Skill | `.claude/skills/wc-analytics-audit/` — audits stats-cache staleness + squad replacements against Wikipedia |

## 3. Data pipelines (how numbers get on screen)

1. **Fixtures/standings**: `/api/worldcup` merges football-data.org matches (groups,
   scores) with the static bracket, computes standings in `resolver.ts`, and attaches
   Sofascore event ids (`fixtureId`) + stadium to group matches, bracket rounds AND
   `thirdPlace` via `attachToBracket`. A match is clickable for analytics only when its
   `fixtureId` is non-null.
2. **Match analytics** (`/api/match?source=rapidapi&id=<sofascoreEventId>`):
   - Serves the `match_analytics` **snapshot first** (overlaying a fresh MOTM lookup),
     else builds live from sportapi7 (`statistics`, `lineups`, `incidents`, `graph`
     endpoints) and **saves a snapshot when** `status === "FT" && home.players.length > 0`.
   - This makes analytics survive the RapidAPI subscription lapsing. Backfill tool:
     `npm run snapshot:matches` (needs a running server; `SNAPSHOT_BASE_URL` to target prod).
3. **Player/team cumulative stats** (`statsSync.ts`): incremental — *ingest* each finished
   fixture once into `fixture_stats` (expensive API calls), then *aggregate* everything
   from the DB (no API calls) into `players.stats` and team aggregates. Runs via daily
   cron and an on-match-open trigger (`after()` from `next/server`); `{force:true}`
   re-aggregates everything.
4. **Man of the Match** (`motmSync.ts` + `match_motm`): scraped from FIFA's CXM page by a
   local script (`npm run sync:motm`). Matching to a fixture is by **FIFA 3-letter code**
   via `FIFA_ARTICLE_TO_CODE`, order-independent (`fifaMotm(homeName, awayName)` in the
   match route). There is deliberately **no Sofascore fallback** — if the scraper has no
   row, show nothing.
5. **Wrapped** (`TournamentWrapped.tsx`): computed 100% client-side from `useSquads()`
   (player stats) + the `/api/worldcup` payload. No extra API calls. See §5.

## 4. Gotchas that already burned time (do not relearn these)

- **Sofascore score object**: `{current, display, normaltime, penalties}` — for shootout
  matches `current` FOLDS IN penalty-shootout goals (shows 4–5 for a 1–1 match). Use
  `display ?? current` for the shown score and surface `penalties` separately.
- **football-data.org score**: same trap — `fullTime` folds shootout goals when
  `duration === "PENALTY_SHOOTOUT"`. Use `regularTime` (+`extraTime`) then; helper
  `fdScore()` in `resolver.ts` already does this. Never read `fullTime` directly.
- **Phantom incidents**: Sofascore emits pre-match/bench cards with `time: -5` and
  `player: null`. The match route filters `minute < 0` and card-without-player.
- **429s**: sportapi7 rate-limits aggressively. `s7()` has retry/backoff — route new
  sportapi7 calls through it, never raw fetch.
- **Stale `fixture_stats` rows**: if a player/team shows blank or outdated stats in
  Team Comparison, suspect fixtures ingested by an older code version (fields missing
  from `data` JSONB). Fix: delete those `fixture_stats` rows and re-run `sync:stats`.
  The `wc-analytics-audit` skill has a stale-cache check for exactly this.
- **MOTM parser**: FIFA page text needs a regex tolerant of apostrophes/accents in team
  names ("Côte d'Ivoire") and score-less "A v B" entries; guard against garbage player
  names via `/stadium|group|\d/i` rejection. See `motmSync.ts` before touching.
- **Accent-insensitive search** everywhere: use `normalizeText()` from `src/lib/text.ts`
  (NFD + strip diacritics + lowercase) on BOTH the query and the candidate.
- **macOS screen-recording filenames** contain a narrow no-break space (U+202F) before
  "PM" — direct path strings fail. Use shell globs: `f=(Screen*4.38.55*.mov)`.
  Also, the sandbox may not read `~/Desktop` — copy files via glob into the scratchpad.
- **tsx scripts**: top-level `await` fails ("cjs output format") — wrap in
  `async function main() {...} main();`.
- **`grep -c` exits 1 on zero matches** — don't chain `&&` after it in verification
  one-liners.
- **flagcdn widths** are typed as `20 | 40 | 80` in `flags.ts#flagUrl`; widen the union
  if you need bigger flags (320 and 640 exist upstream).
- The repo root is `/Users/abhinavp403/Documents/Fifa World Cup/fifa-world-cup-2026`
  (note the space in "Fifa World Cup" — always quote paths).

## 5. Tournament Wrapped (newest feature — likely to get more iterations)

`src/components/TournamentWrapped.tsx`, opened via the gradient "✨ Wrapped" button next
to the mascots logo in the hero (`WorldCupDashboard.tsx` → `showWrapped` state).

- **Story mechanics**: square card `min(960px, 92vmin)` on desktop, full-bleed mobile.
  Slides auto-advance every `SLIDE_MS` (currently **12s, uniform**; per-slide override
  exists via optional `ms` on the slide object). Segmented progress bars animate via
  framer-motion; tap left/right zones, arrow keys, Esc/X close. The last slide holds.
- **Slides are conditional** — each pushes onto the array only if its data exists, so the
  story degrades gracefully pre-tournament.
- **Current slide order**: intro (totals) → Golden Boot (video) → Chief Creator (video)
  → Player of the Tournament (video) → Golden Glove (video) → Goal Machines (photo) →
  Wonderkids → 3 hardcoded record slides (player milestones / drama records / control +
  1000th match) → outro (champion-aware: turns gold with the champion, else "to be
  continued").
- **Hardcoded facts warning**: the three record slides (Ronaldo 6 editions, Messi 19
  goals & 7-match streak, Mora youngest, 11 comeback wins, Tielemans 120'+5, Türkiye 62
  shots, Spain 69% possession, Portugal 93% passing, Japan–Tunisia 1,000th match) are
  static JSX — update manually if events supersede them.
- **Media slides**: `VideoLeadersSlide` (video backdrop, tint gradient overlay + dark
  readability gradient, leaders stacked bottom-right, `anim` prop: `"swish"` | `"pop"` |
  `"drop"`) and `GoalMachinesSlide` (photo backdrop, flip-up `rotateX` rows). Backdrop
  FX for non-media slides: `SlideFX` variants `pitch|balls|net|confetti|none`.
- **Slide titles** use the shared `Eyebrow` pill (frosted dark pill, `text-sm/base`).
- **Adding a video backdrop**: compress with
  `ffmpeg -i in.mov [-t <sec>] -vf "scale=1280:-2" -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -an -movflags +faststart public/<name>.mp4`
  (targets ~2–3MB), then point a `VideoLeadersSlide` at it. Existing assets:
  `public/goldenboot.mp4` (14s), `potm.mp4` (12s), `creator.mp4` (6.5s),
  `goldenglove.mp4` (8.5s), `goalmachines.jpg`.

## 6. Domain conventions

- **Team identity** is the FIFA 3-letter code (`BRA`, `TUR`…) everywhere; maps in
  `flags.ts` translate FIFA↔ISO2 (flags), Sofascore names↔FIFA, FIFA article names↔codes.
  `TEAM_BY_CODE` style lookups come from `GROUPS` in `worldcup.ts`.
- **Coach changes**: recorded in the `teams` table / `squads.ts` as e.g.
  `"Sabri Lamouchi (sacked) → Hervé Renard"` (Tunisia format, shows both) or a straight
  replacement (Haiti). Wikipedia "2026 FIFA World Cup squads" (`?action=raw`) is the
  authoritative source for squads/coaches; the audit skill compares against it.
- **Squad replacements** (injury swaps) are applied directly to `players` rows; keep the
  Sofascore photo id consistent with the player who actually plays (see the CPV
  Gilson Benchimol id fix: wrong id meant unmatched stats).
- **Player photos**: `/api/player-photo/<sofascoreId>` proxy or thesportsdb cutout URLs,
  stored per player in `squads.ts` via the `s()`/`p()` helpers.
- **Themes**: 5 themes (`midnight|pitch|ember|royal|light`) via CSS vars
  (`--accent-*`, `--bg-card`, `--border-card`…). New UI must use the vars, not fixed
  colors — except Wrapped, which is deliberately its own vivid gradient world.
- **GD column** exists in group standings; standings filter to matching teams when
  search/confederation filters are active.

## 7. Routine tasks — recipes

- **"Stats not updating for team X"**: check `fixture_stats` has rows for their finished
  fixtures (`wc-analytics-audit` skill); if rows are stale/thin, delete + `npm run
  sync:stats`. Confirm the fixture appeared in `getS7WorldCupEvents` paging
  (last/0..2 + next/0..1 — expand if the tournament outgrows it).
- **"MOTM wrong/missing"**: re-run `npm run sync:motm` (local Chrome headless required),
  then check the `match_motm` row's team names map through `FIFA_ARTICLE_TO_CODE`.
- **"Knockout match not clickable"**: its Sofascore event id isn't attached — verify
  `/api/worldcup` `attachToBracket` matched it (team codes + date proximity).
- **After the final**: `data.champion` populates automatically; Hero shows ChampionCard,
  Wrapped outro turns gold. Run `npm run snapshot:matches` one last time so every match
  is durably snapshotted before the RapidAPI subscription is cancelled.
- **README** deliberately has no Installation/run sections; keep the live-site link.

## 8. Working-tree notes

Git history is the source of truth for what's committed — use `git log` and
`git status -sb`, not a hand-maintained list here.

`.claude/launch.json` stays uncommitted on purpose (local preview-server config, not
project code).

**Wrapped is hardcoded editorial in places** (see §5): the POTM winner (Rodri), Best
Young Player (Pau Cubarsí), the record-book facts, the "where the goals came from"
figures, and the hero champion (Spain) do NOT track live data — edit them by hand.
Backdrop videos live in `public/*.mp4`, compressed to ~2–4 MB each; always run the
ffmpeg recipe (§5) before committing a new one — originals can be 100+ MB.
