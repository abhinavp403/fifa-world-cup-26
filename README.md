# FIFA World Cup 2026 Dashboard

A sophisticated, real-time dashboard for the FIFA World Cup 2026 featuring live group standings, knockout bracket, venue information, and match analytics.

## Features

- **Live Group Standings** — Real-time standings for all 12 groups with FIFA tiebreak rules (points → goal difference → goals for)
- **Dynamic Knockout Bracket** — 5-round bracket (R32 → R16 → QF → SF → Final) that auto-populates with qualifying teams as results come in
- **Team Search & Filtering** — Filter teams by confederation (UEFA, CONMEBOL, CONCACAF, AFC, CAF, OFC) or search by name
- **Host Cities & Venues** — All 16 host cities across USA, Canada, and Mexico with stadium capacities and match schedules
- **Real-Time Data Integration** — Fetches live match results from football-data.org API (free tier)
- **Group Analytics** — Difficulty ranking (Group of Death / Competitive / Balanced) based on average FIFA rank
- **Responsive Design** — Floating navigation sidebar (desktop) / bottom icon rail (mobile)
- **Aurora Gradient Background** — Animated gradient with smooth drift and noise texture overlay
- **Live Data Status** — Visual indicators show when data is live vs. awaiting draw

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Data Source**: football-data.org API v4 (free tier)
- **Deployment**: Ready for Vercel

## Installation

1. Clone the repository:
```bash
git clone https://github.com/abhinavp403/fifa-world-cup-26.git
cd fifa-world-cup-2026
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file with your football-data.org API key:
```bash
NEXT_PUBLIC_FOOTBALL_DATA_API_KEY=your_api_key_here
```

Get your free API key from [football-data.org](https://www.football-data.org/)

## Running the Application

Development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Build for production:
```bash
npm run build
npm run start
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── worldcup/
│   │       └── route.ts          # API endpoint for groups & bracket
│   ├── globals.css               # Aurora gradient + animations
│   ├── layout.tsx                # Root layout with metadata
│   └── page.tsx                  # Main dashboard page
├── components/
│   ├── WorldCupDashboard.tsx     # Main dashboard with all sections
│   ├── KnockoutBracket.tsx       # Bracket visualization
│   └── SiteNav.tsx               # Floating sidebar navigation
└── lib/
    ├── worldcup.ts               # Teams, groups, hosts, confederations
    ├── bracket.ts                # Bracket structure (104 matches across 5 rounds + 3rd place)
    ├── footballData.ts           # football-data.org API client
    └── resolver.ts               # Derives standings from matches, resolves bracket slots
```

## How It Works

### Data Fetching

The dashboard fetches match data from football-data.org's free API and derives standings automatically (the free tier doesn't provide group-level standings, only match data).

1. **GET /api/worldcup** — Main endpoint that:
   - Fetches all matches for season 2026
   - Computes group standings from finished matches
   - Resolves bracket slots with real teams when available
   - Returns both live and static fallback data

### Group Standings

Standings are computed in real-time from match results using FIFA's official tiebreak rules:
1. **Points** (3 for win, 1 for draw, 0 for loss)
2. **Goal Difference** (goals for - goals against)
3. **Goals For** (total goals scored)

### Bracket Resolution

The knockout bracket uses proxy slots initially:
- **R32**: `1A` vs `2B`, `1C` vs `2D`, etc.
- **R16+**: Proxy labels are replaced with real team objects as matches complete

Dynamic population happens automatically via the `resolveBracket()` function which maps football-data.org matches to bracket positions.

### Caching Strategy

- **Server-side ISR** (Incremental Static Regeneration): revalidates every 5 minutes
- Both API responses and underlying fetches use `revalidate: 300`
- Dashboard updates automatically without manual refresh

## Environment Variables

- `NEXT_PUBLIC_FOOTBALL_DATA_API_KEY` — Your football-data.org API key (free tier)

## Tournament Details

- **Dates**: June 11 – July 19, 2026
- **Format**: 48 teams, 12 groups (A–L), 104 matches + 1 third-place match
- **Hosts**: USA, Canada, Mexico
- **Venues**: 16 host cities across the three nations

## Data Sources

- **Team Data & Groups**: Official draw (December 5, 2025)
- **FIFA Rankings**: April 1, 2026 official rankings from FIFA
- **Match Results**: football-data.org API (updated live)
- **Host Cities & Venues**: Official FIFA 2026 tournament data

## License

MIT

## Support

For issues, questions, or feature requests, please create an issue on the [GitHub repository](https://github.com/abhinavp403/fifa-world-cup-26).
