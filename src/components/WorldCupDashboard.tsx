"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Flag,
  Calendar,
  MapPin,
  Users,
  Globe2,
  Sparkles,
  TrendingUp,
  Hash,
  Activity,
} from "lucide-react";

import {
  GROUPS,
  TOURNAMENT,
  CONFED_COLOR,
  HOST_CITIES,
  type Confederation,
  type Group,
  type Team,
} from "@/lib/worldcup";
import SiteNav from "@/components/SiteNav";
import KnockoutBracket from "@/components/KnockoutBracket";
import MatchAnalytics from "@/components/MatchAnalytics";
import type { Match, Round } from "@/lib/bracket";
import type { GroupRow, ResolvedGroup } from "@/lib/resolver";

// ─────────────────────────────────────────────────────────────────────────────
// Countdown
// ─────────────────────────────────────────────────────────────────────────────

function useCountdown(targetISO: string) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const target = new Date(targetISO).getTime();
  const diff = now == null ? 0 : Math.max(0, target - now);

  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
    ready: now != null,
  };
}

function CountdownBlock({ value, label }: { value: number; label: string }) {
  const padded = value.toString().padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="bg-gradient-to-br from-[#0f2d4a] to-[#071e38] border border-blue-500/30 rounded-xl px-4 sm:px-6 py-3 sm:py-4 min-w-[72px] sm:min-w-[96px] text-center">
          <span className="text-white font-bold text-3xl sm:text-5xl tabular-nums tracking-tight">
            {padded}
          </span>
        </div>
        <div className="absolute inset-0 rounded-xl bg-blue-500/10 blur-xl -z-10" />
      </div>
      <span className="text-gray-500 text-[10px] sm:text-xs font-semibold tracking-widest mt-2 uppercase">
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

function Hero() {
  const c = useCountdown(TOURNAMENT.startDate);

  return (
    <section id="overview" className="relative pt-16 pb-12 px-4 scroll-mt-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-8 items-center">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center gap-2 bg-blue-500/15 border border-blue-500/30 rounded-full px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-blue-300 text-xs font-bold tracking-widest">
                  TOURNAMENT DASHBOARD
                </span>
              </span>
              <span className="text-gray-500 text-xs hidden sm:inline">
                · {TOURNAMENT.tagline}
              </span>
            </div>

            <h1 className="text-white font-black text-4xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight">
              FIFA World Cup
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
                2026
              </span>
            </h1>

            <p className="text-gray-400 mt-6 max-w-xl text-base sm:text-lg">
              48 nations. 12 groups. 104 matches. The largest World Cup in
              history, hosted across the{" "}
              <span className="text-white">United States</span>,{" "}
              <span className="text-white">Canada</span> and{" "}
              <span className="text-white">Mexico</span>.
            </p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-6 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Calendar className="w-4 h-4 text-blue-400" />
                Jun 11 — Jul 19, 2026
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <MapPin className="w-4 h-4 text-blue-400" />
                {TOURNAMENT.hostCities} host cities
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Trophy className="w-4 h-4 text-blue-400" />
                Final: {TOURNAMENT.finalVenue}
              </div>
            </div>
          </div>

          <div className="bg-[#071e38]/70 backdrop-blur-md border border-[#0f2d4a] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <span className="text-gray-500 text-xs font-semibold tracking-widest uppercase">
                Kickoff in
              </span>
              <span className="text-blue-400 text-xs font-semibold">
                Opening · {TOURNAMENT.openingVenue}
              </span>
            </div>
            <div className="flex justify-between gap-2 sm:gap-3">
              <CountdownBlock value={c.days} label="Days" />
              <CountdownBlock value={c.hours} label="Hours" />
              <CountdownBlock value={c.minutes} label="Mins" />
              <CountdownBlock value={c.seconds} label="Secs" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat strip
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  value,
  label,
  hint,
  accent = "blue",
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  hint?: string;
  accent?: "blue" | "emerald" | "amber" | "rose";
}) {
  const accentMap = {
    blue: "from-blue-500/20 to-blue-500/0 text-blue-400",
    emerald: "from-emerald-500/20 to-emerald-500/0 text-emerald-400",
    amber: "from-amber-500/20 to-amber-500/0 text-amber-400",
    rose: "from-rose-500/20 to-rose-500/0 text-rose-400",
  } as const;
  return (
    <div className="relative bg-[#071e38] border border-[#0f2d4a] rounded-2xl p-5 overflow-hidden">
      <div
        className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${accentMap[accent]} blur-2xl opacity-60`}
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-gray-500 text-xs uppercase tracking-widest">
          <span className={accentMap[accent].split(" ").pop()}>{icon}</span>
          {label}
        </div>
        <div className="text-white font-bold text-3xl mt-2 tabular-nums">
          {value}
        </div>
        {hint && <div className="text-gray-500 text-xs mt-1">{hint}</div>}
      </div>
    </div>
  );
}

function StatStrip() {
  const confedCounts = useMemo(() => {
    const map = new Map<Confederation, number>();
    GROUPS.forEach((g) =>
      g.teams.forEach((t) =>
        map.set(t.confederation, (map.get(t.confederation) ?? 0) + 1),
      ),
    );
    return map;
  }, []);

  const debutants = useMemo(
    () =>
      GROUPS.flatMap((g) => g.teams).filter((t) => t.appearances === 1).length,
    [],
  );

  return (
    <section className="px-4 pb-10">
      <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<Flag className="w-4 h-4" />}
          value={TOURNAMENT.totalTeams}
          label="Nations"
          hint="Largest WC ever"
          accent="blue"
        />
        <StatCard
          icon={<Hash className="w-4 h-4" />}
          value={TOURNAMENT.totalGroups}
          label="Groups"
          hint="A–L · 4 teams each"
          accent="emerald"
        />
        <StatCard
          icon={<Activity className="w-4 h-4" />}
          value={TOURNAMENT.totalMatches}
          label="Matches"
          hint="Group stage → Final"
          accent="amber"
        />
        <StatCard
          icon={<Sparkles className="w-4 h-4" />}
          value={debutants}
          label="Debutants"
          hint="First-ever WC appearance"
          accent="rose"
        />
      </div>

      <div className="max-w-7xl mx-auto mt-4 bg-[#071e38] border border-[#0f2d4a] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-blue-400" />
            <span className="text-white font-semibold text-sm">
              Confederation breakdown
            </span>
          </div>
          <span className="text-gray-500 text-xs">
            {TOURNAMENT.totalTeams} qualified nations
          </span>
        </div>

        <div className="flex h-3 rounded-full overflow-hidden border border-[#0f2d4a]">
          {Array.from(confedCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([conf, n]) => (
              <div
                key={conf}
                style={{
                  width: `${(n / TOURNAMENT.totalTeams) * 100}%`,
                  backgroundColor: CONFED_COLOR[conf],
                }}
                title={`${conf}: ${n}`}
              />
            ))}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-xs">
          {Array.from(confedCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([conf, n]) => (
              <div key={conf} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: CONFED_COLOR[conf] }}
                />
                <span className="text-gray-300 font-medium">{conf}</span>
                <span className="text-gray-500">{n}</span>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Groups
// ─────────────────────────────────────────────────────────────────────────────

function rankTier(rank: number): { label: string; color: string } {
  if (rank <= 10) return { label: "Elite", color: "text-emerald-300" };
  if (rank <= 25) return { label: "Contender", color: "text-blue-300" };
  if (rank <= 50) return { label: "Solid", color: "text-amber-300" };
  return { label: "Outsider", color: "text-rose-300" };
}

function TeamRow({ team }: { team: Team }) {
  const tier = rankTier(team.fifaRank);
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[#0f2d4a] last:border-b-0">
      <span className="text-2xl flex-shrink-0 leading-none">{team.flag}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white font-semibold text-sm truncate">
            {team.name}
          </p>
          {team.host && (
            <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded">
              HOST
            </span>
          )}
        </div>
        <p className="text-gray-500 text-[11px] truncate">
          {team.code} · {team.confederation} · {team.appearances} WC
          {team.appearances === 1 ? "" : "s"}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-1 justify-end">
          <TrendingUp className={`w-3 h-3 ${tier.color}`} />
          <span className={`text-[11px] font-semibold ${tier.color}`}>
            #{team.fifaRank}
          </span>
        </div>
        <p className="text-gray-600 text-[10px] mt-0.5">{tier.label}</p>
      </div>
    </div>
  );
}

function StandingsTable({ rows }: { rows: GroupRow[] }) {
  return (
    <div className="mt-3 border border-[#0f2d4a] rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1.6rem_1fr_repeat(4,1.5rem)_1.8rem] gap-1 px-2 py-1.5 bg-[#020d1c]/50 text-[9px] uppercase tracking-widest text-gray-500 font-bold">
        <div>#</div>
        <div>Team</div>
        <div className="text-right">P</div>
        <div className="text-right">W</div>
        <div className="text-right">D</div>
        <div className="text-right">L</div>
        <div className="text-right">Pts</div>
      </div>
      {rows.map((r) => {
        const adv =
          r.position <= 2
            ? "border-l-2 border-l-emerald-400/60"
            : r.position === 3
            ? "border-l-2 border-l-amber-400/50"
            : "border-l-2 border-l-transparent";
        return (
          <div
            key={r.team.code}
            className={`grid grid-cols-[1.6rem_1fr_repeat(4,1.5rem)_1.8rem] gap-1 items-center px-2 py-1.5 text-[11px] border-t border-[#0f2d4a] ${adv}`}
          >
            <div className="text-gray-500 font-bold tabular-nums">{r.position}</div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-base leading-none">{r.team.flag}</span>
              <span className="text-white font-semibold truncate">
                {r.team.code}
              </span>
            </div>
            <div className="text-right text-gray-300 tabular-nums">{r.played}</div>
            <div className="text-right text-gray-300 tabular-nums">{r.won}</div>
            <div className="text-right text-gray-300 tabular-nums">{r.drawn}</div>
            <div className="text-right text-gray-300 tabular-nums">{r.lost}</div>
            <div className="text-right text-white font-bold tabular-nums">
              {r.points}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GroupCard({
  group,
  i,
  rows,
}: {
  group: Group;
  i: number;
  rows?: GroupRow[] | null;
}) {
  const avgRank = Math.round(
    group.teams.reduce((a, t) => a + t.fifaRank, 0) / group.teams.length,
  );
  const topTeam = [...group.teams].sort((a, b) => a.fifaRank - b.fifaRank)[0];

  const difficulty =
    avgRank <= 20
      ? { label: "Group of Death", color: "bg-rose-500/20 text-rose-300 border-rose-500/40" }
      : avgRank <= 35
      ? { label: "Competitive", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" }
      : { label: "Balanced", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, ease: "easeOut", delay: (i % 4) * 0.05 }}
      className="relative bg-[#071e38] border border-[#0f2d4a] rounded-2xl p-5 hover:border-blue-500/40 transition-colors"
    >
      <div className="absolute top-2 right-3 text-[80px] font-black text-white/[0.03] leading-none select-none pointer-events-none">
        {group.letter}
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/25 to-blue-500/5 border border-blue-500/30 flex items-center justify-center">
              <span className="text-blue-200 font-black text-base">
                {group.letter}
              </span>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">
                Group {group.letter}
              </p>
              <p className="text-gray-500 text-[11px] mt-1">
                Avg rank #{avgRank} · Top: {topTeam.name}
              </p>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded border ${difficulty.color}`}
          >
            {difficulty.label.toUpperCase()}
          </span>
        </div>

        {rows && rows.length > 0 ? (
          <StandingsTable rows={rows} />
        ) : (
          <div className="mt-3">
            {group.teams
              .slice()
              .sort((a, b) => a.fifaRank - b.fifaRank)
              .map((t) => (
                <TeamRow key={t.code} team={t} />
              ))}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-[#0f2d4a] flex items-center justify-between text-[11px]">
          <span className="text-gray-500">
            Matchday 1 · Jun {12 + (i % 5)}, 2026
          </span>
          <span className="text-blue-400 font-semibold">6 matches</span>
        </div>
      </div>
    </motion.div>
  );
}

function GroupsSection({
  resolved,
}: {
  resolved?: ResolvedGroup[] | null;
}) {
  const [search, setSearch] = useState("");
  const [confFilter, setConfFilter] = useState<Confederation | "ALL">("ALL");

  // Map letter → live rows, if any
  const rowsByLetter = useMemo(() => {
    const m = new Map<string, GroupRow[] | null>();
    (resolved ?? []).forEach((g) => m.set(g.letter, g.rows));
    return m;
  }, [resolved]);

  const hasLiveStandings = useMemo(
    () => (resolved ?? []).some((g) => g.rows && g.rows.length > 0),
    [resolved],
  );

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q && confFilter === "ALL") return GROUPS;
    return GROUPS.map((g) => {
      const teams = g.teams.filter((t) => {
        const matchesSearch =
          !q ||
          t.name.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q);
        const matchesConf =
          confFilter === "ALL" || t.confederation === confFilter;
        return matchesSearch && matchesConf;
      });
      return { ...g, teams };
    }).filter((g) => g.teams.length > 0);
  }, [search, confFilter]);

  const confs: ("ALL" | Confederation)[] = [
    "ALL",
    "UEFA",
    "CONMEBOL",
    "CONCACAF",
    "AFC",
    "CAF",
    "OFC",
  ];

  return (
    <section id="groups" className="px-4 py-10 scroll-mt-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-blue-400" />
              <h2 className="text-white font-bold text-2xl">Group Stage</h2>
            </div>
            <p className="text-gray-500 text-sm">
              All 48 nations · 12 groups of 4 · top two + best eight thirds
              advance to the Round of 32
            </p>
            {hasLiveStandings && (
              <span className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-bold tracking-widest text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE STANDINGS
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team…"
              className="bg-[#071e38] border border-[#0f2d4a] rounded-full px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 w-44"
            />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-6">
          {confs.map((c) => {
            const active = confFilter === c;
            return (
              <button
                key={c}
                onClick={() => setConfFilter(c)}
                className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all border ${
                  active
                    ? "bg-[#0f2d4a] text-white border-blue-500/40"
                    : "bg-transparent text-gray-400 border-[#0f2d4a] hover:text-white"
                }`}
              >
                {c !== "ALL" && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: CONFED_COLOR[c] }}
                  />
                )}
                {c === "ALL" ? "All confederations" : c}
              </button>
            );
          })}
        </div>

        {filteredGroups.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Flag className="w-10 h-10 mx-auto mb-3 opacity-30" />
            No teams match those filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredGroups.map((g, i) => (
              <GroupCard
                key={g.letter}
                group={g}
                i={i}
                rows={rowsByLetter.get(g.letter)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Host cities
// ─────────────────────────────────────────────────────────────────────────────

const COUNTRY_FLAG: Record<string, string> = {
  USA: "🇺🇸",
  Canada: "🇨🇦",
  Mexico: "🇲🇽",
};

const HIGHLIGHT_BADGE: Record<
  NonNullable<(typeof HOST_CITIES)[number]["highlight"]>,
  { label: string; className: string }
> = {
  opening: {
    label: "OPENING",
    className: "bg-blue-500/15 text-blue-200 border-blue-500/30",
  },
  final: {
    label: "FINAL",
    className: "bg-amber-400/15 text-amber-200 border-amber-400/40",
  },
  third: {
    label: "3RD PLACE",
    className: "bg-rose-500/15 text-rose-200 border-rose-500/30",
  },
};

function HostCitiesSection() {
  const sorted = [...HOST_CITIES].sort((a, b) => {
    if (b.matches !== a.matches) return b.matches - a.matches;
    return b.capacity - a.capacity;
  });
  const maxMatches = Math.max(...HOST_CITIES.map((c) => c.matches));
  const totalMatches = HOST_CITIES.reduce((sum, c) => sum + c.matches, 0);

  return (
    <section id="cities" className="px-4 py-10 scroll-mt-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="w-5 h-5 text-blue-400" />
          <h2 className="text-white font-bold text-2xl">Host Cities</h2>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          16 venues · 3 nations · {totalMatches} matches · ranked by matches
          hosted
        </p>

        <div className="bg-[#071e38] border border-[#0f2d4a] rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_2fr_0.8fr_0.7fr_1.6fr] gap-x-4 px-5 py-3 border-b border-[#0f2d4a] text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
            <div>City</div>
            <div className="hidden sm:block">Stadium</div>
            <div className="hidden sm:block text-right">Cap.</div>
            <div className="text-right">Matches</div>
            <div className="hidden sm:block">Match load</div>
          </div>

          {sorted.map((c, i) => {
            const pct = (c.matches / maxMatches) * 100;
            const badge = c.highlight ? HIGHLIGHT_BADGE[c.highlight] : null;
            return (
              <div
                key={c.city}
                className={`grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_2fr_0.8fr_0.7fr_1.6fr] gap-x-4 items-center px-5 py-3 ${
                  i !== sorted.length - 1 ? "border-b border-[#0f2d4a]" : ""
                }`}
              >
                {/* City + flag + (mobile) stadium + badge */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg leading-none">
                    {COUNTRY_FLAG[c.country] ?? "🏟️"}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-white text-sm font-semibold truncate">
                        {c.city}
                      </p>
                      {badge && (
                        <span
                          className={`hidden sm:inline-flex text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded border ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-[11px] sm:hidden truncate">
                      {c.stadium}
                      {badge && (
                        <span className="ml-1.5 text-[9px] font-bold tracking-widest text-blue-300">
                          · {badge.label}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Stadium */}
                <div className="hidden sm:block text-gray-400 text-sm truncate">
                  {c.stadium}
                </div>

                {/* Capacity */}
                <div className="hidden sm:block text-right text-gray-300 text-sm tabular-nums">
                  {(c.capacity / 1000).toFixed(0)}k
                </div>

                {/* Matches */}
                <div className="text-right text-white text-sm tabular-nums font-bold">
                  {c.matches}
                </div>

                {/* Load bar */}
                <div className="hidden sm:flex items-center gap-2">
                  <div className="h-1.5 rounded-full bg-[#0f2d4a] overflow-hidden flex-1">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-gray-500 text-[10px] tabular-nums w-8 text-right">
                    {Math.round(pct)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Match results placeholder
// ─────────────────────────────────────────────────────────────────────────────

function ResultsPlaceholder() {
  return (
    <section id="analytics" className="px-4 py-10 scroll-mt-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-blue-400" />
          <h2 className="text-white font-bold text-2xl">Match Analytics</h2>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          Per-game stats, xG, possession, shots, and key moments will land here
          as fixtures complete.
        </p>

        <div className="relative bg-gradient-to-br from-[#071e38] to-[#020d1c] border border-[#0f2d4a] rounded-2xl p-8 sm:p-12 text-center overflow-hidden">
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-3xl" />
          </div>

          <div className="relative">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 mb-5">
              <Calendar className="w-7 h-7 text-blue-300" />
            </div>
            <h3 className="text-white font-bold text-xl mb-2">
              Match center opens June 11, 2026
            </h3>
            <p className="text-gray-400 max-w-xl mx-auto text-sm">
              Once the tournament kicks off, this section will surface scores,
              xG charts, possession splits, shot maps, attendance, and a live
              standings table for every group.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 max-w-2xl mx-auto">
              {[
                { label: "Scores", icon: <Hash className="w-4 h-4" /> },
                { label: "xG charts", icon: <TrendingUp className="w-4 h-4" /> },
                { label: "Shot maps", icon: <Activity className="w-4 h-4" /> },
                { label: "Standings", icon: <Trophy className="w-4 h-4" /> },
              ].map((p) => (
                <div
                  key={p.label}
                  className="bg-[#071e38]/60 border border-[#0f2d4a] rounded-xl px-3 py-3 flex items-center gap-2 justify-center"
                >
                  <span className="text-blue-400">{p.icon}</span>
                  <span className="text-gray-300 text-xs font-semibold">
                    {p.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page shell
// ─────────────────────────────────────────────────────────────────────────────

type WorldCupPayload = {
  live: boolean;
  updatedAt: string;
  groups: ResolvedGroup[];
  bracket: Round[];
  thirdPlace: Match;
};

export default function WorldCupDashboard() {
  const [data, setData] = useState<WorldCupPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/worldcup")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: WorldCupPayload | null) => {
        if (!cancelled && json) setData(json);
      })
      .catch(() => {
        /* fall back to static data */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // We treat "live" as true only if the API surfaced any standings or
  // populated bracket slots — not merely the presence of an API key.
  const hasLiveBracket = !!data?.bracket?.some((r) =>
    r.matches.some((m) => m.slot1.team || m.slot2.team),
  );

  return (
    <main className="bg-[#020d1c] min-h-screen bg-aurora">
      <SiteNav />
      <div className="relative z-10 lg:pl-56 pb-24 lg:pb-0">
        <Hero />
        <StatStrip />
        <GroupsSection resolved={data?.groups} />
        <KnockoutBracket
          rounds={data?.bracket}
          thirdPlace={data?.thirdPlace}
          live={hasLiveBracket}
        />
        <HostCitiesSection />
        <MatchAnalytics />

        <footer className="border-t border-[#071e38] py-8 px-4 text-center mt-10">
          <p className="text-gray-600 text-sm">
            FIFA World Cup 2026 · USA · Canada · Mexico
          </p>
          <p className="text-gray-700 text-xs mt-1">
            Dashboard updates as matches complete.
          </p>
        </footer>
      </div>
    </main>
  );
}
