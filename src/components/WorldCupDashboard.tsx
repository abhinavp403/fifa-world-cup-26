"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
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
  ChevronRight,
  ChevronDown,
  X,
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
import PlayerDashboard from "@/components/PlayerDashboard";
import PlayersSection from "@/components/PlayersSection";
import TeamComparison from "@/components/TeamComparison";
import { SQUADS } from "@/lib/squads";
import type { Match, Round } from "@/lib/bracket";
import type { GroupMatch, GroupRow, ResolvedGroup } from "@/lib/resolver";

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
        <div className="bg-gradient-to-br from-[var(--border-card)] to-[var(--bg-card)] border border-[var(--accent-500)]/30 rounded-xl px-4 sm:px-6 py-3 sm:py-4 min-w-[72px] sm:min-w-[96px] text-center">
          <span className="text-white font-bold text-3xl sm:text-5xl tabular-nums tracking-tight">
            {padded}
          </span>
        </div>
        <div className="absolute inset-0 rounded-xl bg-[var(--accent-500)]/10 blur-xl -z-10" />
      </div>
      <span className="text-gray-500 text-[10px] sm:text-xs font-semibold tracking-widest mt-2 uppercase">
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Today's matches card (shown during the tournament)
// ─────────────────────────────────────────────────────────────────────────────

type TodayMatch = {
  utcDate: string;
  status:  string;
  round:   string;            // "Group A", "Round of 32", "Final", etc.
  home:    { code: string | null; flag: string; name: string };
  away:    { code: string | null; flag: string; name: string };
  homeScore: number | null;
  awayScore: number | null;
};

function isToday(iso: string, now: Date) {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function collectTodayMatches(data: WorldCupPayload | null, now: Date): TodayMatch[] {
  if (!data) return [];
  const out: TodayMatch[] = [];

  // Group-stage matches
  data.groups.forEach((g) => {
    (g.matches ?? []).forEach((m) => {
      if (!isToday(m.utcDate, now)) return;
      out.push({
        utcDate:   m.utcDate,
        status:    m.status,
        round:     `Group ${g.letter}`,
        home:      { code: m.homeCode, flag: m.homeFlag, name: m.homeName },
        away:      { code: m.awayCode, flag: m.awayFlag, name: m.awayName },
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      });
    });
  });

  // Bracket matches
  data.bracket.forEach((round) => {
    round.matches.forEach((m) => {
      if (!m.date || !isToday(m.date, now)) return;
      out.push({
        utcDate:   m.date,
        status:    "",
        round:     round.name,
        home:      {
          code: m.slot1.team?.code ?? null,
          flag: m.slot1.team?.flag ?? "⚽",
          name: m.slot1.team?.name ?? m.slot1.label,
        },
        away:      {
          code: m.slot2.team?.code ?? null,
          flag: m.slot2.team?.flag ?? "⚽",
          name: m.slot2.team?.name ?? m.slot2.label,
        },
        homeScore: null,
        awayScore: null,
      });
    });
  });

  out.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
  return out;
}

function TodayStatusBadge({ status }: { status: string }) {
  if (status === "IN_PLAY" || status === "PAUSED" || status === "LIVE") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest text-emerald-300">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        LIVE
      </span>
    );
  }
  if (status === "FINISHED") {
    return <span className="text-[10px] font-bold tracking-widest text-gray-500">FT</span>;
  }
  return null;
}

function TodayMatchesCard({ data }: { data: WorldCupPayload | null }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const matches = now ? collectTodayMatches(data, now) : [];
  const dateLabel = now
    ? now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })
    : "";

  return (
    <div className="bg-[var(--bg-card)]/70 backdrop-blur-md border border-[var(--border-card)] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <span className="text-gray-500 text-xs font-semibold tracking-widest uppercase">
          Today&apos;s Matches
        </span>
        <span className="text-[var(--accent-400)] text-xs font-semibold">{dateLabel}</span>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">No matches scheduled today.</p>
          <p className="text-gray-600 text-xs mt-1">Check back tomorrow.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((m, i) => (
            <div
              key={`${m.utcDate}-${i}`}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-[var(--bg-darker)]/60 border border-[var(--border-card)] rounded-xl px-3 py-2.5"
            >
              <div className="flex items-center gap-2 min-w-0 justify-end">
                <span className="text-white font-semibold text-sm truncate">{m.home.name}</span>
                <span className="text-xl leading-none flex-shrink-0">{m.home.flag}</span>
              </div>
              <div className="flex flex-col items-center px-2">
                {m.status === "FINISHED" || m.homeScore != null ? (
                  <span className="text-white font-black text-base tabular-nums">
                    {m.homeScore ?? 0}–{m.awayScore ?? 0}
                  </span>
                ) : (
                  <span className="text-gray-400 text-xs font-semibold tabular-nums">
                    {formatKickoff(m.utcDate)}
                  </span>
                )}
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] tracking-widest text-gray-600 uppercase">
                    {m.round}
                  </span>
                  <TodayStatusBadge status={m.status} />
                </div>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl leading-none flex-shrink-0">{m.away.flag}</span>
                <span className="text-white font-semibold text-sm truncate">{m.away.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Champion banner (shown once the final is decided)
// ─────────────────────────────────────────────────────────────────────────────

function ChampionCard({ champion }: { champion: Team }) {
  return (
    <div className="relative bg-gradient-to-br from-amber-500/15 via-[var(--bg-card)]/70 to-[var(--bg-card)]/70 backdrop-blur-md border border-amber-500/40 rounded-2xl p-6 overflow-hidden">
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-amber-300 text-xs font-bold tracking-widest uppercase">
            World Champions · 2026
          </span>
        </div>
        <div className="flex items-center gap-5">
          <span className="text-7xl leading-none drop-shadow-lg">{champion.flag}</span>
          <div className="min-w-0">
            <p className="text-white font-black text-3xl sm:text-4xl leading-tight">
              {champion.name}
            </p>
            <p className="text-amber-200/80 text-sm font-semibold mt-1">
              {champion.confederation} · FIFA #{champion.fifaRank}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme picker
// ─────────────────────────────────────────────────────────────────────────────

export type ThemeId = "midnight" | "pitch" | "ember" | "royal" | "light";

const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: "midnight", label: "Midnight", swatch: "#3b82f6" },
  { id: "pitch",    label: "Pitch",    swatch: "#22c55e" },
  { id: "ember",    label: "Ember",    swatch: "#f97316" },
  { id: "royal",    label: "Royal",    swatch: "#a855f7" },
  { id: "light",    label: "Light",    swatch: "#f1f5f9" },
];

function ThemePicker({
  theme,
  onChange,
}: {
  theme:    ThemeId;
  onChange: (t: ThemeId) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-[var(--bg-card)]/60 backdrop-blur-md border border-[var(--border-card)] rounded-full px-3 py-1.5 self-end">
      <span className="text-gray-500 text-[10px] tracking-widest font-bold uppercase">
        Theme
      </span>
      <div className="flex items-center gap-1.5">
        {THEMES.map((t) => {
          const active = theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              aria-label={`Use ${t.label} theme`}
              title={t.label}
              className={`w-5 h-5 rounded-full transition-all ${
                active
                  ? "ring-2 ring-[var(--accent-400)] ring-offset-2 ring-offset-[var(--bg-card)]"
                  : "hover:scale-110"
              }`}
              style={{
                backgroundColor: t.swatch,
                boxShadow: t.id === "light" ? "inset 0 0 0 1px rgba(0,0,0,0.2)" : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

function Hero({
  data,
  theme,
  onThemeChange,
}: {
  data:          WorldCupPayload | null;
  theme:         ThemeId;
  onThemeChange: (t: ThemeId) => void;
}) {
  const c = useCountdown(TOURNAMENT.startDate);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const startMs = new Date(TOURNAMENT.startDate).getTime();
  const phase: "pre" | "during" | "post" =
    data?.champion
      ? "post"
      : now == null || now < startMs
      ? "pre"
      : "during";

  return (
    <section id="overview" className="relative pt-16 pb-12 px-4 scroll-mt-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-8 items-center">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center gap-2 bg-[var(--accent-500)]/15 border border-[var(--accent-500)]/30 rounded-full px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-[var(--accent-300)] text-xs font-bold tracking-widest">
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
              <span className="bg-gradient-to-r from-[var(--grad-from)] via-[var(--grad-via)] to-[var(--grad-to)] bg-clip-text text-transparent">
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
                <Calendar className="w-4 h-4 text-[var(--accent-400)]" />
                Jun 11 — Jul 19, 2026
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <MapPin className="w-4 h-4 text-[var(--accent-400)]" />
                {TOURNAMENT.hostCities} host cities
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Trophy className="w-4 h-4 text-[var(--accent-400)]" />
                Final: {TOURNAMENT.finalVenue}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <ThemePicker theme={theme} onChange={onThemeChange} />
            {phase === "post" && data?.champion ? (
              <ChampionCard champion={data.champion} />
            ) : phase === "during" ? (
              <TodayMatchesCard data={data} />
            ) : (
              <div className="bg-[var(--bg-card)]/70 backdrop-blur-md border border-[var(--border-card)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-gray-500 text-xs font-semibold tracking-widest uppercase">
                    Kickoff in
                  </span>
                  <span className="text-[var(--accent-400)] text-xs font-semibold">
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
            )}
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
    blue: "from-[var(--accent-500)]/20 to-[var(--accent-500)]/0 text-[var(--accent-400)]",
    emerald: "from-emerald-500/20 to-emerald-500/0 text-emerald-400",
    amber: "from-amber-500/20 to-amber-500/0 text-amber-400",
    rose: "from-rose-500/20 to-rose-500/0 text-rose-400",
  } as const;
  return (
    <div className="relative bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 overflow-hidden">
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

      <div className="max-w-7xl mx-auto mt-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-[var(--accent-400)]" />
            <span className="text-white font-semibold text-sm">
              Confederation breakdown
            </span>
          </div>
          <span className="text-gray-500 text-xs">
            {TOURNAMENT.totalTeams} qualified nations
          </span>
        </div>

        <div className="flex h-3 rounded-full overflow-hidden border border-[var(--border-card)]">
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
  if (rank <= 25) return { label: "Contender", color: "text-[var(--accent-300)]" };
  if (rank <= 50) return { label: "Solid", color: "text-amber-300" };
  return { label: "Outsider", color: "text-rose-300" };
}

function TeamRow({
  team,
  onTeamClick,
}: {
  team: Team;
  onTeamClick?: (code: string) => void;
}) {
  const tier       = rankTier(team.fifaRank);
  const hasSquad   = !!SQUADS[team.code];
  const clickable  = hasSquad && !!onTeamClick;

  const inner = (
    <>
      <span className="text-2xl flex-shrink-0 leading-none">{team.flag}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white font-semibold text-sm truncate">{team.name}</p>
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
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={() => onTeamClick(team.code)}
        className="w-full flex items-center gap-3 py-2.5 border-b border-[var(--border-card)] last:border-b-0 hover:bg-[var(--border-card)]/60 transition-colors cursor-pointer text-left rounded-lg px-1 -mx-1"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--border-card)] last:border-b-0">
      {inner}
    </div>
  );
}

function StandingsTable({ rows }: { rows: GroupRow[] }) {
  return (
    <div className="mt-3 border border-[var(--border-card)] rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1.6rem_1fr_repeat(4,1.5rem)_1.8rem] gap-1 px-2 py-1.5 bg-[var(--bg-darker)]/50 text-[9px] uppercase tracking-widest text-gray-500 font-bold">
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
            className={`grid grid-cols-[1.6rem_1fr_repeat(4,1.5rem)_1.8rem] gap-1 items-center px-2 py-1.5 text-[11px] border-t border-[var(--border-card)] ${adv}`}
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

function GroupMatchRow({
  match,
  onMatchClick,
}: {
  match: GroupMatch;
  onMatchClick: (fixtureId: number | null, label: string, date: string) => void;
}) {
  const isFinished = match.status === "FINISHED" || match.status === "AWARDED";
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const hasScore = isFinished || isLive;
  const kickoff = new Date(match.utcDate);

  return (
    <button
      type="button"
      onClick={() =>
        onMatchClick(
          match.fixtureId,
          `${match.homeName} vs ${match.awayName}`,
          match.utcDate,
        )
      }
      className="w-full text-left group flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-[var(--border-card)]/60 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <span className="text-base leading-none">{match.homeFlag}</span>
        <span className="text-white text-[12px] font-semibold truncate">
          {match.homeCode}
        </span>
      </div>

      <div className="text-center flex-shrink-0 w-20">
        {hasScore ? (
          <span className="text-white font-bold text-sm tabular-nums">
            {match.homeScore ?? 0} – {match.awayScore ?? 0}
          </span>
        ) : (
          <span className="text-gray-400 text-[11px]">
            {kickoff.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
        {isLive && (
          <span className="block text-[9px] font-bold text-rose-400 tracking-wider">LIVE</span>
        )}
        {isFinished && (
          <span className="block text-[9px] font-bold text-emerald-400/70 tracking-wider">FT</span>
        )}
      </div>

      <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
        <span className="text-white text-[12px] font-semibold truncate">
          {match.awayCode}
        </span>
        <span className="text-base leading-none">{match.awayFlag}</span>
      </div>

      <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-[var(--accent-400)] flex-shrink-0 transition-colors" />
    </button>
  );
}

function GroupCard({
  group,
  i,
  rows,
  matches,
  onMatchClick,
  onTeamClick,
}: {
  group: Group;
  i: number;
  rows?: GroupRow[] | null;
  matches?: GroupMatch[] | null;
  onMatchClick: (fixtureId: number | null, label: string, date: string) => void;
  onTeamClick?: (code: string) => void;
}) {
  const [matchesOpen, setMatchesOpen] = useState(false);

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
      className="relative bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 hover:border-[var(--accent-500)]/40 transition-colors"
    >
      <div className="absolute top-2 right-3 text-[80px] font-black text-white/[0.03] leading-none select-none pointer-events-none">
        {group.letter}
      </div>

      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--accent-500)]/25 to-[var(--accent-500)]/5 border border-[var(--accent-500)]/30 flex items-center justify-center">
              <span className="text-[var(--accent-300)] font-black text-base">
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
                <TeamRow key={t.code} team={t} onTeamClick={onTeamClick} />
              ))}
          </div>
        )}

        {/* See All Matches toggle */}
        <div className="mt-3 pt-3 border-t border-[var(--border-card)]">
          <button
            type="button"
            onClick={() => setMatchesOpen((v) => !v)}
            className="w-full flex items-center justify-between text-[12px] font-semibold text-[var(--accent-400)] hover:text-[var(--accent-300)] transition-colors group"
          >
            <span>See All Matches</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${matchesOpen ? "rotate-180" : ""}`}
            />
          </button>

          {matchesOpen && (
            <div className="mt-2 space-y-0.5">
              {matches && matches.length > 0 ? (
                matches.map((m) => (
                  <GroupMatchRow
                    key={m.id}
                    match={m}
                    onMatchClick={onMatchClick}
                  />
                ))
              ) : (
                <p className="text-gray-500 text-[11px] py-3 text-center">
                  Fixtures will appear here when the draw is complete.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function GroupsSection({
  resolved,
  onMatchClick,
  onTeamClick,
}: {
  resolved?: ResolvedGroup[] | null;
  onMatchClick: (fixtureId: number | null, label: string, date: string) => void;
  onTeamClick?: (code: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [confFilter, setConfFilter] = useState<Confederation | "ALL">("ALL");

  // Map letter → live rows / matches, if any
  const rowsByLetter = useMemo(() => {
    const m = new Map<string, GroupRow[] | null>();
    (resolved ?? []).forEach((g) => m.set(g.letter, g.rows));
    return m;
  }, [resolved]);

  const matchesByLetter = useMemo(() => {
    const m = new Map<string, GroupMatch[] | null>();
    (resolved ?? []).forEach((g) => m.set(g.letter, g.matches));
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
              <Users className="w-5 h-5 text-[var(--accent-400)]" />
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
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team…"
                className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-full px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[var(--accent-500)]/50 w-44 pr-8"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="2" y1="2" x2="12" y2="12" />
                    <line x1="12" y1="2" x2="2" y2="12" />
                  </svg>
                </button>
              )}
            </div>
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
                    ? "bg-[var(--border-card)] text-white border-[var(--accent-500)]/40"
                    : "bg-transparent text-gray-400 border-[var(--border-card)] hover:text-white"
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
                matches={matchesByLetter.get(g.letter)}
                onMatchClick={onMatchClick}
                onTeamClick={onTeamClick}
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
    className: "bg-[var(--accent-500)]/15 text-[var(--accent-300)] border-[var(--accent-500)]/30",
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
          <MapPin className="w-5 h-5 text-[var(--accent-400)]" />
          <h2 className="text-white font-bold text-2xl">Host Cities</h2>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          16 venues · 3 nations · {totalMatches} matches · ranked by matches
          hosted
        </p>

        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_2fr_0.8fr_0.7fr_1.6fr] gap-x-4 px-5 py-3 border-b border-[var(--border-card)] text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
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
                  i !== sorted.length - 1 ? "border-b border-[var(--border-card)]" : ""
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
                        <span className="ml-1.5 text-[9px] font-bold tracking-widest text-[var(--accent-300)]">
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
                  <div className="h-1.5 rounded-full bg-[var(--border-card)] overflow-hidden flex-1">
                    <div
                      className="h-full bg-gradient-to-r from-[var(--grad-from)] to-[var(--grad-via)]"
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
          <Trophy className="w-5 h-5 text-[var(--accent-400)]" />
          <h2 className="text-white font-bold text-2xl">Match Analytics</h2>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          Per-game stats, xG, possession, shots, and key moments will land here
          as fixtures complete.
        </p>

        <div className="relative bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-darker)] border border-[var(--border-card)] rounded-2xl p-8 sm:p-12 text-center overflow-hidden">
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[var(--accent-500)]/10 blur-3xl" />
          </div>

          <div className="relative">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--accent-500)]/10 border border-[var(--accent-500)]/30 mb-5">
              <Calendar className="w-7 h-7 text-[var(--accent-300)]" />
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
                  className="bg-[var(--bg-card)]/60 border border-[var(--border-card)] rounded-xl px-3 py-3 flex items-center gap-2 justify-center"
                >
                  <span className="text-[var(--accent-400)]">{p.icon}</span>
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
// Match center — list of matches with clickable rows
// ─────────────────────────────────────────────────────────────────────────────

type MatchListItem = {
  fixtureId: number;
  competition: string;
  competitionNote?: string;
  date: string; // ISO
  venue: string;
  status: "FT" | "LIVE" | "UPCOMING";
  home: { name: string; logo: string; score: number | null };
  away: { name: string; logo: string; score: number | null };
};

const SAMPLE_MATCHES: MatchListItem[] = [
  {
    fixtureId: 1379275,
    competition: "Premier League",
    competitionNote: "Sample match — analytics preview",
    date: "2026-05-13T19:00:00Z",
    venue: "Etihad Stadium",
    status: "FT",
    home: {
      name: "Manchester City",
      logo: "https://media.api-sports.io/football/teams/50.png",
      score: 3,
    },
    away: {
      name: "Crystal Palace",
      logo: "https://media.api-sports.io/football/teams/52.png",
      score: 0,
    },
  },
];

function StatusBadge({ status }: { status: MatchListItem["status"] }) {
  if (status === "LIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold px-2.5 py-1 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
        LIVE
      </span>
    );
  }
  if (status === "FT") {
    return (
      <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-full">
        FULL TIME
      </span>
    );
  }
  return (
    <span className="bg-[var(--accent-500)]/15 border border-[var(--accent-500)]/30 text-[var(--accent-300)] text-xs font-bold px-2.5 py-1 rounded-full">
      UPCOMING
    </span>
  );
}

function MatchRow({
  match,
  onClick,
  active,
}: {
  match: MatchListItem;
  onClick: () => void;
  active: boolean;
}) {
  const hasScore = match.home.score != null && match.away.score != null;
  const kickoff = new Date(match.date);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`w-full text-left bg-[var(--bg-card)]/80 hover:bg-[#0a2647]/90 border rounded-2xl p-4 sm:p-5 transition-all group ${
        active
          ? "border-[var(--accent-500)]/60 ring-1 ring-blue-500/30"
          : "border-[var(--border-strong)] hover:border-[var(--accent-500)]/40"
      }`}
    >
      {/* Top meta row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
        <div className="flex items-center gap-2 text-gray-400">
          <span className="font-semibold uppercase tracking-wider">
            {match.competition}
          </span>
          {match.competitionNote && (
            <>
              <span className="text-gray-600">·</span>
              <span className="text-gray-500">{match.competitionNote}</span>
            </>
          )}
        </div>
        <StatusBadge status={match.status} />
      </div>

      {/* Teams + score */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src={match.home.logo}
            alt={match.home.name}
            width={40}
            height={40}
            className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
            unoptimized
          />
          <span className="text-white font-semibold truncate text-sm sm:text-base">
            {match.home.name}
          </span>
        </div>

        <div className="text-center">
          {hasScore ? (
            <div className="flex items-center gap-2 sm:gap-3 text-2xl sm:text-3xl font-bold text-white">
              <span>{match.home.score}</span>
              <span className="text-gray-600 text-base">—</span>
              <span>{match.away.score}</span>
            </div>
          ) : (
            <div className="text-gray-300 text-sm font-semibold">
              {kickoff.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 min-w-0 justify-end">
          <span className="text-white font-semibold truncate text-sm sm:text-base text-right">
            {match.away.name}
          </span>
          <Image
            src={match.away.logo}
            alt={match.away.name}
            width={40}
            height={40}
            className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
            unoptimized
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-card)] text-xs text-gray-400">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {match.venue}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {kickoff.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        <span className="flex items-center gap-1 text-[var(--accent-300)] font-semibold opacity-80 group-hover:opacity-100 transition-opacity">
          View analytics
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </motion.button>
  );
}

function MatchCenter({
  selectedId,
  onSelect,
}: {
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <section id="matches" className="px-4 py-10 scroll-mt-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-[var(--accent-400)]" />
          <h2 className="text-white font-bold text-2xl">Match Center</h2>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          Click any match to open full analytics — stats, timeline, formations,
          and player ratings.
        </p>

        <div className="space-y-3">
          {SAMPLE_MATCHES.map((m) => (
            <MatchRow
              key={m.fixtureId}
              match={m}
              active={selectedId === m.fixtureId}
              onClick={() => onSelect(m.fixtureId)}
            />
          ))}
        </div>

        <p className="text-gray-600 text-xs mt-6 text-center">
          World Cup fixtures will appear here as the tournament approaches.
        </p>
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
  champion: Team | null;
};

// Simple "coming soon" modal for matches that don't have an api-football fixture ID yet.
function UpcomingMatchModal({
  label,
  date,
  onClose,
}: {
  label: string;
  date: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const kickoff = new Date(date);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="relative bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 inline-flex items-center justify-center rounded-full bg-[var(--border-card)] border border-[var(--border-strong)] text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <Calendar className="w-10 h-10 text-[var(--accent-400)] mx-auto mb-4" />
        <p className="text-white font-bold text-lg mb-1">{label}</p>
        <p className="text-gray-400 text-sm mb-4">
          {kickoff.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          {" · "}
          {kickoff.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </p>
        <p className="text-gray-500 text-xs">
          Match analytics will be available once this fixture kicks off.
        </p>
      </motion.div>
    </div>
  );
}

type SelectedMatch =
  | { type: "analytics"; fixtureId: number }
  | { type: "upcoming"; label: string; date: string }
  | null;

export default function WorldCupDashboard() {
  const [data, setData] = useState<WorldCupPayload | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<SelectedMatch>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [initialPlayerNumber, setInitialPlayerNumber] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemeId>("midnight");

  // Restore saved theme on mount.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("wc-theme") : null;
    if (
      saved === "midnight" ||
      saved === "pitch" ||
      saved === "ember" ||
      saved === "royal" ||
      saved === "light"
    ) {
      setTheme(saved);
    }
  }, []);

  const updateTheme = (t: ThemeId) => {
    setTheme(t);
    if (typeof window !== "undefined") localStorage.setItem("wc-theme", t);
  };

  // Mirror the current theme class onto <html> so global elements outside
  // <main> (e.g. the native browser scrollbar) can be styled per theme.
  useEffect(() => {
    const root = document.documentElement;
    const ALL_THEMES = ["midnight", "pitch", "ember", "royal", "light"] as const;
    ALL_THEMES.forEach((t) => root.classList.remove(`theme-${t}`));
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  const openTeamPlayer = (teamCode: string, playerNumber: number) => {
    setInitialPlayerNumber(playerNumber);
    setSelectedTeam(teamCode);
  };
  const closePlayerDashboard = () => {
    setSelectedTeam(null);
    setInitialPlayerNumber(null);
  };

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

  const hasLiveBracket = !!data?.bracket?.some((r) =>
    r.matches.some((m) => m.slot1.team || m.slot2.team),
  );

  const handleMatchClick = (fixtureId: number | null, label: string, date: string) => {
    if (fixtureId != null) {
      setSelectedMatch({ type: "analytics", fixtureId });
    } else {
      setSelectedMatch({ type: "upcoming", label, date });
    }
  };

  const handleClose = () => setSelectedMatch(null);

  // Legacy: MatchCenter still passes a plain number
  const handleSelectMatch = (id: number) =>
    setSelectedMatch({ type: "analytics", fixtureId: id });

  const analyticsFixtureId =
    selectedMatch?.type === "analytics" ? selectedMatch.fixtureId : null;

  return (
    <main className={`min-h-screen bg-aurora theme-${theme}`}>
      <SiteNav isModalOpen={selectedMatch !== null || selectedTeam !== null} />
      <div className="relative z-10 lg:pl-56 pb-24 lg:pb-0">
        <Hero data={data} theme={theme} onThemeChange={updateTheme} />
        <StatStrip />
        <GroupsSection
          resolved={data?.groups}
          onMatchClick={handleMatchClick}
          onTeamClick={(code) => { setInitialPlayerNumber(null); setSelectedTeam(code); }}
        />
        <KnockoutBracket
          rounds={data?.bracket}
          thirdPlace={data?.thirdPlace}
          live={hasLiveBracket}
          onMatchClick={handleMatchClick}
        />
        <section className="px-4 pt-0 pb-4 scroll-mt-12">
          <div className="max-w-7xl mx-auto">
            <TeamComparison payload={data} />
          </div>
        </section>
        <PlayersSection onPlayerClick={openTeamPlayer} />
        <HostCitiesSection />
        <MatchCenter
          selectedId={analyticsFixtureId}
          onSelect={handleSelectMatch}
        />
        <MatchAnalytics
          fixtureId={analyticsFixtureId}
          onClose={handleClose}
        />
        <PlayerDashboard
          teamCode={selectedTeam}
          initialPlayerNumber={initialPlayerNumber}
          onClose={closePlayerDashboard}
        />
        {selectedMatch?.type === "upcoming" && (
          <UpcomingMatchModal
            label={selectedMatch.label}
            date={selectedMatch.date}
            onClose={handleClose}
          />
        )}

        <footer className="border-t border-[var(--bg-card)] py-8 px-4 text-center mt-10">
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
