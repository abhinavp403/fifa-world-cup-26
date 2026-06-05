"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Goal,
  Sparkles,
  ShieldCheck,
  Search,
  X,
  User,
  ArrowLeftRight,
  Check,
} from "lucide-react";

import { GROUPS, TEAM_COLORS } from "@/lib/worldcup";
import { type SquadPlayer, type PlayerStats } from "@/lib/squads";
import { useSquads } from "@/lib/squadsContext";
import Flag from "@/components/Flag";

// ─────────────────────────────────────────────────────────────────────────────
// Types & helpers
// ─────────────────────────────────────────────────────────────────────────────

type PlayerWithTeam = {
  player:    SquadPlayer;
  teamCode:  string;
  teamName:  string;
  teamFlag:  string;
  teamColor: string;
};

const ALL_TEAMS = GROUPS.flatMap((g) => g.teams);

function getStat(p: SquadPlayer, key: keyof PlayerStats): number {
  return p.stats?.[key] ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Player avatar
// ─────────────────────────────────────────────────────────────────────────────

function PlayerAvatar({
  player,
  color,
  size = 36,
}: {
  player: SquadPlayer;
  color:  string;
  size?:  number;
}) {
  return (
    <div
      className="relative flex-shrink-0 rounded-full overflow-hidden"
      style={{ width: size, height: size }}
    >
      {player.photo ? (
        <Image
          src={player.photo}
          alt={player.name}
          fill
          sizes={`${size}px`}
          className="object-cover object-top"
          style={{ backgroundColor: color + "22" }}
          unoptimized
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-[11px] font-black text-white"
          style={{ backgroundColor: color + "55", border: `1px solid ${color}44` }}
        >
          {player.number}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LeaderCard — one of the three top-5 tables
// ─────────────────────────────────────────────────────────────────────────────

function LeaderCard({
  title,
  Icon,
  accent,
  statKey,
  players,
  filterFn,
  onPlayerClick,
}: {
  title:         string;
  Icon:          typeof Goal;
  accent:        string;
  statKey:       keyof PlayerStats;
  players:       PlayerWithTeam[];
  filterFn?:     (p: SquadPlayer) => boolean;
  onPlayerClick: (teamCode: string, number: number) => void;
}) {
  const top = useMemo(() => {
    const pool = filterFn ? players.filter((p) => filterFn(p.player)) : players;
    return [...pool]
      .sort((a, b) => {
        const diff = getStat(b.player, statKey) - getStat(a.player, statKey);
        if (diff !== 0) return diff;
        return a.player.name.localeCompare(b.player.name);
      })
      .slice(0, 5);
  }, [players, statKey, filterFn]);

  return (
    <div className="bg-[var(--bg-card)]/70 border border-[var(--border-card)] rounded-2xl overflow-hidden">
      <div
        className="px-4 py-3 border-b border-[var(--border-card)] flex items-center gap-2.5"
        style={{ background: `linear-gradient(to right, ${accent}11, transparent)` }}
      >
        <Icon className="w-4 h-4" style={{ color: accent }} />
        <h3 className="text-white font-bold text-sm tracking-tight">{title}</h3>
      </div>
      <div className="divide-y divide-[var(--border-row)]/60">
        {top.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-600 text-xs">No players yet.</p>
        ) : (
          top.map((p, i) => (
            <button
              type="button"
              key={`${p.teamCode}-${p.player.number}`}
              onClick={() => onPlayerClick(p.teamCode, p.player.number)}
              className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <span className="text-gray-600 text-[10px] font-black w-3 tabular-nums text-center">
                {i + 1}
              </span>
              <PlayerAvatar player={p.player} color={p.teamColor} size={34} />
              <div className="min-w-0 flex-1">
                <p className="text-white text-[13px] font-semibold truncate leading-tight">
                  {p.player.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Flag code={p.teamCode} size="sm" />
                  <span className="text-gray-600 text-[10px] truncate">{p.teamName}</span>
                </div>
              </div>
              <span
                className="font-black text-base tabular-nums flex-shrink-0"
                style={{ color: accent }}
              >
                {getStat(p.player, statKey)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchResultCard — shows one matched player with base stats
// ─────────────────────────────────────────────────────────────────────────────

function SearchResultCard({
  p,
  onClick,
  isInCompare,
  compareDisabled,
  onToggleCompare,
}: {
  p:               PlayerWithTeam;
  onClick:         () => void;
  isInCompare:     boolean;
  compareDisabled: boolean;
  onToggleCompare: () => void;
}) {
  const pos = p.player.position;
  const dimmed = compareDisabled && !isInCompare;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={`w-full text-left bg-[var(--bg-card)]/60 border rounded-xl px-4 py-3 flex items-center gap-4 transition-colors cursor-pointer ${
        isInCompare
          ? "border-[var(--accent-500)]/60 bg-[var(--accent-500)]/[0.06]"
          : "border-[var(--border-card)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-card)]/90"
      } ${dimmed ? "opacity-40" : ""}`}
    >
      <PlayerAvatar player={p.player} color={p.teamColor} size={48} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-bold text-base truncate">{p.player.name}</span>
          {p.player.captain && (
            <span
              className="text-[8px] font-black px-1 py-0.5 rounded tracking-wider flex-shrink-0"
              style={{ color: p.teamColor, backgroundColor: p.teamColor + "22", border: `1px solid ${p.teamColor}44` }}
            >
              CAP
            </span>
          )}
          <span
            className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ color: p.teamColor, backgroundColor: p.teamColor + "22" }}
          >
            {pos}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 flex-wrap">
          <Flag code={p.teamCode} size="sm" />
          <span className="text-gray-400 font-semibold">{p.teamName}</span>
          <span className="text-gray-700">·</span>
          <span className="truncate">{p.player.club}</span>
          <span className="text-gray-700">·</span>
          <span>Age {p.player.age}</span>
        </div>
      </div>

      {/* Compare checkbox */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (!dimmed) onToggleCompare(); }}
        disabled={dimmed}
        aria-pressed={isInCompare}
        aria-label={isInCompare ? "Remove from comparison" : "Add to comparison"}
        title={dimmed ? `Only ${pos === "GK" ? "GKs" : pos + "s"} of the same position can be compared` : isInCompare ? "Selected for comparison" : "Add to comparison"}
        className={`flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center transition-all ${
          isInCompare
            ? "bg-[var(--accent-500)] border-[var(--accent-500)] text-white"
            : "bg-[var(--bg-darker)]/60 border-[var(--border-card)] text-gray-600 hover:border-[var(--accent-500)]/50 hover:text-[var(--accent-400)]"
        } ${dimmed ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        {isInCompare ? <Check className="w-4 h-4" /> : <ArrowLeftRight className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Player comparison — position-aware stat config + modal
// ─────────────────────────────────────────────────────────────────────────────

type CompareStat = {
  label: string;
  get:   (s: PlayerStats) => number | null;
  fmt?:  (v: number) => string;
};

const fmtPct = (v: number) => `${v}%`;
const fmtRtg = (v: number) => v.toFixed(1);
const safePct = (num: number, den: number) =>
  den > 0 ? Math.round((num / den) * 100) : null;

const COMPARE_STATS: Record<"GK" | "DEF" | "MID" | "FWD", CompareStat[]> = {
  GK: [
    { label: "Appearances",     get: (s) => s.appearances },
    { label: "Minutes Played",  get: (s) => s.minutesPlayed },
    { label: "Saves",           get: (s) => s.saves },
    { label: "Clean Sheets",    get: (s) => s.cleanSheets },
    { label: "Goals Conceded",  get: (s) => s.goalsConceded },
    { label: "Penalties Saved", get: (s) => s.penaltySaved },
    { label: "Save %",          get: (s) => safePct(s.saves, s.saves + s.goalsConceded), fmt: fmtPct },
    { label: "Avg Rating",      get: (s) => (s.rating > 0 ? s.rating : null), fmt: fmtRtg },
  ],
  DEF: [
    { label: "Appearances",     get: (s) => s.appearances },
    { label: "Minutes Played",  get: (s) => s.minutesPlayed },
    { label: "Goals",           get: (s) => s.goals },
    { label: "Assists",         get: (s) => s.assists },
    { label: "Key Passes",      get: (s) => s.keyPasses },
    { label: "Tackles",         get: (s) => s.tackles },
    { label: "Interceptions",   get: (s) => s.interceptions },
    { label: "Duels Won",       get: (s) => s.duelsWon },
    { label: "Dribbles",        get: (s) => s.dribbles },
    { label: "Total Passes",    get: (s) => s.passes },
    { label: "Pass Acc %",      get: (s) => (s.passAccuracy > 0 ? s.passAccuracy : null), fmt: fmtPct },
    { label: "Avg Rating",      get: (s) => (s.rating > 0 ? s.rating : null), fmt: fmtRtg },
  ],
  MID: [
    { label: "Appearances",     get: (s) => s.appearances },
    { label: "Minutes Played",  get: (s) => s.minutesPlayed },
    { label: "Goals",           get: (s) => s.goals },
    { label: "Assists",         get: (s) => s.assists },
    { label: "Shots",           get: (s) => s.shots },
    { label: "Key Passes",      get: (s) => s.keyPasses },
    { label: "Dribbles",        get: (s) => s.dribbles },
    { label: "Interceptions",   get: (s) => s.interceptions },
    { label: "Total Passes",    get: (s) => s.passes },
    { label: "Pass Acc %",      get: (s) => (s.passAccuracy > 0 ? s.passAccuracy : null), fmt: fmtPct },
    { label: "Avg Rating",      get: (s) => (s.rating > 0 ? s.rating : null), fmt: fmtRtg },
  ],
  FWD: [
    { label: "Appearances",     get: (s) => s.appearances },
    { label: "Minutes Played",  get: (s) => s.minutesPlayed },
    { label: "Goals",           get: (s) => s.goals },
    { label: "Assists",         get: (s) => s.assists },
    { label: "Shots",           get: (s) => s.shots },
    { label: "Shots on Target", get: (s) => s.shotsOnTarget },
    { label: "Shooting Acc %",  get: (s) => safePct(s.shotsOnTarget, s.shots), fmt: fmtPct },
    { label: "Key Passes",      get: (s) => s.keyPasses },
    { label: "Dribbles",        get: (s) => s.dribbles },
    { label: "Penalty Goals",   get: (s) => s.penaltyScored },
    { label: "Avg Rating",      get: (s) => (s.rating > 0 ? s.rating : null), fmt: fmtRtg },
  ],
};

function ComparePlayerHeader({ p }: { p: PlayerWithTeam }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 px-2">
      <PlayerAvatar player={p.player} color={p.teamColor} size={72} />
      <div className="min-w-0">
        <p className="text-white font-black text-lg leading-tight truncate">
          {p.player.name}
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-1 text-xs text-gray-400">
          <Flag code={p.teamCode} size="sm" />
          <span className="font-semibold">{p.teamName}</span>
        </div>
        <p className="text-gray-600 text-[11px] mt-0.5 truncate">{p.player.club}</p>
        <div className="flex items-center justify-center gap-1.5 mt-1.5">
          <span
            className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded"
            style={{ color: p.teamColor, backgroundColor: p.teamColor + "22" }}
          >
            {p.player.position}
          </span>
          <span className="text-gray-700 text-[10px]">·</span>
          <span className="text-gray-500 text-[10px]">Age {p.player.age}</span>
        </div>
      </div>
    </div>
  );
}

function CompareStatRow({
  label,
  valA,
  valB,
  fmt,
}: {
  label: string;
  valA:  number | null;
  valB:  number | null;
  fmt?:  (v: number) => string;
}) {
  const show = (v: number | null) => (v == null ? "—" : fmt ? fmt(v) : String(v));
  const a = valA ?? 0;
  const b = valB ?? 0;
  const aWins = valA != null && valB != null && a > b;
  const bWins = valA != null && valB != null && b > a;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-2.5 border-b border-[var(--border-row)]/60 last:border-0">
      <p
        className={`text-right text-base tabular-nums ${
          aWins ? "text-white font-black" : "text-gray-500 font-semibold"
        }`}
      >
        {show(valA)}
      </p>
      <p className="text-[10px] font-bold tracking-widest text-gray-600 uppercase whitespace-nowrap min-w-[7rem] text-center">
        {label}
      </p>
      <p
        className={`text-left text-base tabular-nums ${
          bWins ? "text-white font-black" : "text-gray-500 font-semibold"
        }`}
      >
        {show(valB)}
      </p>
    </div>
  );
}

function PlayerComparisonModal({
  players,
  onClose,
}: {
  players: PlayerWithTeam[];
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (players.length !== 2) return null;
  const [a, b] = players;
  const pos = a.player.position as keyof typeof COMPARE_STATS;
  const stats = COMPARE_STATS[pos] ?? [];

  const sA = a.player.stats ?? null;
  const sB = b.player.stats ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-6"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative bg-[var(--bg-darker)] border border-[var(--border-strong)] sm:rounded-2xl w-full sm:max-w-3xl max-h-screen sm:max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div
          className="h-1 w-full rounded-t-2xl flex-shrink-0"
          style={{
            background: `linear-gradient(to right, ${a.teamColor}, ${a.teamColor}33 50%, ${b.teamColor}33 50%, ${b.teamColor})`,
          }}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sticky top-3 float-right mr-7 z-10 w-9 h-9 inline-flex items-center justify-center rounded-full bg-[var(--bg-card)]/90 border border-[var(--border-strong)] text-gray-300 hover:text-white hover:border-white/30 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-4 sm:px-8 py-6">
          <div className="flex items-center gap-2 mb-6">
            <ArrowLeftRight className="w-4 h-4 text-[var(--accent-400)]" />
            <span className="text-[10px] font-black tracking-widest uppercase text-[var(--accent-300)]">
              Player Comparison · {pos}
            </span>
          </div>

          {/* Headers */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 pb-6 mb-4 border-b border-[var(--border-card)]">
            <ComparePlayerHeader p={a} />
            <span className="text-gray-700 text-2xl font-black self-center px-2">vs</span>
            <ComparePlayerHeader p={b} />
          </div>

          {/* Stat rows */}
          <div className="bg-[var(--bg-card)]/60 border border-[var(--border-card)] rounded-xl overflow-hidden">
            {sA && sB ? (
              stats.map((stat) => (
                <CompareStatRow
                  key={stat.label}
                  label={stat.label}
                  valA={stat.get(sA)}
                  valB={stat.get(sB)}
                  fmt={stat.fmt}
                />
              ))
            ) : (
              <p className="text-gray-600 text-sm py-8 text-center">
                Stats not available yet.
              </p>
            )}
          </div>

          <p className="text-gray-700 text-[10px] text-center mt-4">
            WC 2026 tournament stats only · Updates once matches begin
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main section
// ─────────────────────────────────────────────────────────────────────────────

type PositionFilter = "ALL" | "GK" | "DEF" | "MID" | "FWD";

const POSITION_TAGS: { id: PositionFilter; label: string }[] = [
  { id: "ALL", label: "All"  },
  { id: "GK",  label: "GK"   },
  { id: "DEF", label: "DEF"  },
  { id: "MID", label: "MID"  },
  { id: "FWD", label: "FWD"  },
];

export default function PlayersSection({
  onPlayerClick,
}: {
  onPlayerClick: (teamCode: string, playerNumber: number) => void;
}) {
  const squads = useSquads();
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<PositionFilter>("ALL");
  const [compare, setCompare] = useState<PlayerWithTeam[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const lockedPosition = compare[0]?.player.position ?? null;

  const playerKey = (p: PlayerWithTeam) => `${p.teamCode}-${p.player.number}`;
  const isInCompare = (p: PlayerWithTeam) =>
    compare.some((x) => playerKey(x) === playerKey(p));

  const toggleCompare = (p: PlayerWithTeam) => {
    setCompare((prev) => {
      const exists = prev.find((x) => playerKey(x) === playerKey(p));
      if (exists) return prev.filter((x) => playerKey(x) !== playerKey(p));
      if (prev.length >= 2) return prev;
      if (prev.length > 0 && prev[0].player.position !== p.player.position) return prev;
      return [...prev, p];
    });
  };

  const clearCompare = () => setCompare([]);

  const allPlayers = useMemo<PlayerWithTeam[]>(() => {
    const result: PlayerWithTeam[] = [];
    for (const [code, squad] of Object.entries(squads)) {
      const team = ALL_TEAMS.find((t) => t.code === code);
      if (!team) continue;
      const teamColor = TEAM_COLORS[code] ?? "#3b82f6";
      for (const player of squad.players) {
        result.push({
          player,
          teamCode:  code,
          teamName:  team.name,
          teamFlag:  team.flag,
          teamColor,
        });
      }
    }
    return result;
  }, [squads]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length === 0) return [];
    return allPlayers
      .filter((p) => p.player.name.toLowerCase().includes(q))
      .filter((p) => posFilter === "ALL" || p.player.position === posFilter)
      .sort((a, b) => a.player.name.localeCompare(b.player.name))
      .slice(0, 25);
  }, [search, posFilter, allPlayers]);

  return (
    <section id="players" className="px-4 py-10 scroll-mt-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <User className="w-5 h-5 text-[var(--accent-400)]" />
          <h2 className="text-white font-bold text-2xl">Player Leaders</h2>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          Top performers across the tournament · auto-updates as matches are played
        </p>

        {/* ── 3 leader tables ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <LeaderCard
            title="Most Goals"
            Icon={Goal}
            accent="#4ade80"
            statKey="goals"
            players={allPlayers}
            onPlayerClick={onPlayerClick}
          />
          <LeaderCard
            title="Most Assists"
            Icon={Sparkles}
            accent="#60a5fa"
            statKey="assists"
            players={allPlayers}
            onPlayerClick={onPlayerClick}
          />
          <LeaderCard
            title="Most Clean Sheets"
            Icon={ShieldCheck}
            accent="#fbbf24"
            statKey="cleanSheets"
            players={allPlayers}
            filterFn={(p) => p.position === "GK"}
            onPlayerClick={onPlayerClick}
          />
        </div>

        {/* ── Search ── */}
        <div className="bg-[var(--bg-card)]/60 border border-[var(--border-card)] rounded-2xl p-5">
          <h3 className="text-white font-bold text-base mb-1">Player Search</h3>
          <p className="text-gray-500 text-xs mb-4">
            Search by name to view a player&apos;s stats, or pick two from the same
            position to compare them side-by-side
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type a player name…"
                className="w-full bg-[var(--bg-darker)] border border-[var(--border-card)] rounded-full pl-10 pr-9 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[var(--accent-500)]/50"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {POSITION_TAGS.map((t) => {
                const active = posFilter === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPosFilter(t.id)}
                    className={`text-[11px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-full border transition-colors ${
                      active
                        ? "tag-active text-white"
                        : "bg-[var(--bg-darker)] border-[var(--border-card)] text-gray-400 hover:text-white hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compare tray */}
          {compare.length > 0 && (
            <div className="bg-[var(--bg-darker)]/60 border border-[var(--accent-500)]/30 rounded-xl p-3 mb-5 flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-black tracking-widest uppercase text-[var(--accent-300)] inline-flex items-center gap-1.5">
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Comparing {compare.length}/2 · {lockedPosition}
              </span>
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                {compare.map((p) => (
                  <div
                    key={playerKey(p)}
                    className="inline-flex items-center gap-1.5 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-full pl-2 pr-1 py-1"
                  >
                    <Flag code={p.teamCode} size="sm" />
                    <span className="text-white text-xs font-semibold truncate max-w-[10rem]">
                      {p.player.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleCompare(p)}
                      className="ml-0.5 w-5 h-5 inline-flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                      aria-label={`Remove ${p.player.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {compare.length < 2 && (
                  <span className="text-gray-600 text-[11px] italic">
                    + add one more {lockedPosition === "GK" ? "GK" : `${lockedPosition}`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  disabled={compare.length !== 2}
                  onClick={() => setShowCompareModal(true)}
                  className={`text-xs font-bold tracking-wider uppercase px-3 py-1.5 rounded-full transition-colors ${
                    compare.length === 2
                      ? "bg-[var(--accent-500)] text-white hover:brightness-110"
                      : "bg-[var(--bg-card)] text-gray-600 cursor-not-allowed"
                  }`}
                >
                  Compare
                </button>
                <button
                  type="button"
                  onClick={clearCompare}
                  className="text-gray-500 hover:text-white text-xs font-semibold transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {search.trim().length > 0 && (
            <>
              {searchResults.length === 0 ? (
                <p className="text-gray-600 text-sm italic px-1">
                  No players match &quot;{search}&quot;.
                </p>
              ) : (
                <>
                  <p className="text-gray-600 text-[11px] tracking-wider uppercase font-bold mb-3">
                    {searchResults.length} {searchResults.length === 1 ? "result" : "results"}
                  </p>
                  <div className="space-y-2">
                    {searchResults.map((p) => {
                      const selected = isInCompare(p);
                      const positionMismatch =
                        lockedPosition != null && p.player.position !== lockedPosition;
                      const slotsFull = compare.length >= 2 && !selected;
                      return (
                        <SearchResultCard
                          key={`${p.teamCode}-${p.player.number}`}
                          p={p}
                          isInCompare={selected}
                          compareDisabled={positionMismatch || slotsFull}
                          onToggleCompare={() => toggleCompare(p)}
                          onClick={() => onPlayerClick(p.teamCode, p.player.number)}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showCompareModal && compare.length === 2 && (
        <PlayerComparisonModal
          players={compare}
          onClose={() => setShowCompareModal(false)}
        />
      )}
    </section>
  );
}
