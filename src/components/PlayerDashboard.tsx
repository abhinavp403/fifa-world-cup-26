"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { X, ChevronUp, ChevronDown } from "lucide-react";

import { GROUPS, TEAM_COLORS } from "@/lib/worldcup";
import { SQUADS, ZERO_STATS, type SquadPlayer, type PlayerStats } from "@/lib/squads";

// ─────────────────────────────────────────────────────────────────────────────
// Stat column definitions per position
// ─────────────────────────────────────────────────────────────────────────────

type StatDef = { key: keyof PlayerStats; label: string; title: string };
type SortDir = "asc" | "desc";

const POS_STAT_DEFS: Record<string, StatDef[]> = {
  GK: [
    { key: "appearances",   label: "AP",  title: "Appearances"    },
    { key: "minutesPlayed", label: "MIN", title: "Minutes Played" },
    { key: "saves",         label: "SV",  title: "Saves"          },
    { key: "cleanSheets",   label: "CS",  title: "Clean Sheets"   },
    { key: "goalsConceded", label: "GC",  title: "Goals Conceded" },
  ],
  DEF: [
    { key: "appearances",   label: "AP",  title: "Appearances"    },
    { key: "minutesPlayed", label: "MIN", title: "Minutes Played" },
    { key: "goals",         label: "G",   title: "Goals"          },
    { key: "assists",       label: "A",   title: "Assists"        },
    { key: "tackles",       label: "TKL", title: "Tackles"        },
    { key: "interceptions", label: "INT", title: "Interceptions"  },
  ],
  MID: [
    { key: "appearances",   label: "AP",  title: "Appearances"    },
    { key: "minutesPlayed", label: "MIN", title: "Minutes Played" },
    { key: "goals",         label: "G",   title: "Goals"          },
    { key: "assists",       label: "A",   title: "Assists"        },
    { key: "keyPasses",     label: "KP",  title: "Key Passes"     },
    { key: "dribbles",      label: "DRB", title: "Dribbles"       },
  ],
  FWD: [
    { key: "appearances",   label: "AP",  title: "Appearances"    },
    { key: "minutesPlayed", label: "MIN", title: "Minutes Played" },
    { key: "goals",         label: "G",   title: "Goals"          },
    { key: "assists",       label: "A",   title: "Assists"        },
    { key: "shots",         label: "SH",  title: "Shots"          },
    { key: "shotsOnTarget", label: "SOT", title: "Shots on Target"},
  ],
};

const POS_LABEL: Record<string, string> = {
  GK:  "Goalkeepers",
  DEF: "Defenders",
  MID: "Midfielders",
  FWD: "Forwards",
};

const ALL_TEAMS = GROUPS.flatMap((g) => g.teams);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function statCols(n: number) {
  // photo | name | n stat columns
  return `5.5rem 1fr ${"4.2rem ".repeat(n).trim()}`;
}

function getStat(player: SquadPlayer, key: keyof PlayerStats): number {
  return player.stats?.[key] ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// PlayerRow
// ─────────────────────────────────────────────────────────────────────────────

function PlayerRow({
  player,
  statDefs,
  sortKey,
  teamColor,
}: {
  player:    SquadPlayer;
  statDefs:  StatDef[];
  sortKey:   keyof PlayerStats;
  teamColor: string;
}) {
  return (
    <div
      className="grid items-center gap-x-4 px-4 py-4 border-b border-[#0d2540]/60 last:border-0 hover:bg-white/[0.025] transition-colors"
      style={{ gridTemplateColumns: statCols(statDefs.length) }}
    >
      {/* Photo + jersey number overlay */}
      <div className="relative mx-auto flex-shrink-0 w-16 h-16">
        {player.photo ? (
          <Image
            src={player.photo}
            alt={player.name}
            fill
            sizes="64px"
            className="object-cover object-top rounded-full"
            style={{ backgroundColor: teamColor + "22" }}
            unoptimized
          />
        ) : (
          <div
            className="w-full h-full rounded-full flex items-center justify-center text-sm font-black text-white"
            style={{ backgroundColor: teamColor + "55", border: `1px solid ${teamColor}44` }}
          >
            {player.number}
          </div>
        )}
        <span
          className="absolute -bottom-0.5 -right-0.5 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full leading-none"
          style={{ backgroundColor: teamColor, color: "#020d1c" }}
        >
          {player.number}
        </span>
      </div>

      {/* Name + club */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white text-lg font-semibold truncate leading-tight">
            {player.name}
          </span>
          {player.captain && (
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider flex-shrink-0"
              style={{ color: teamColor, backgroundColor: teamColor + "22", border: `1px solid ${teamColor}44` }}
            >
              CAP
            </span>
          )}
        </div>
        <p className="text-gray-500 text-sm truncate mt-0.5">{player.club}</p>
      </div>

      {/* Stat values */}
      {statDefs.map(({ key }) => {
        const val = getStat(player, key);
        const isActive = key === sortKey;
        return (
          <p
            key={key}
            className={`text-lg text-center tabular-nums ${
              isActive && val > 0
                ? "text-white font-bold"
                : val > 0
                ? "text-gray-300"
                : "text-gray-700"
            }`}
          >
            {val}
          </p>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PositionGroup — owns its own sort state
// ─────────────────────────────────────────────────────────────────────────────

function PositionGroup({
  pos,
  players,
  teamColor,
}: {
  pos:       string;
  players:   SquadPlayer[];
  teamColor: string;
}) {
  const statDefs = POS_STAT_DEFS[pos] ?? [];

  const [sort, setSort] = useState<{ col: keyof PlayerStats; dir: SortDir }>({
    col: statDefs[0]?.key ?? "appearances",
    dir: "desc",
  });

  if (players.length === 0) return null;

  const sorted = [...players].sort((a, b) => {
    const diff = getStat(a, sort.col) - getStat(b, sort.col);
    return sort.dir === "desc" ? -diff : diff;
  });

  const handleSort = (col: keyof PlayerStats) => {
    setSort((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { col, dir: "desc" },
    );
  };

  function ColBtn({ def }: { def: StatDef }) {
    const active = sort.col === def.key;
    return (
      <button
        type="button"
        title={def.title}
        onClick={() => handleSort(def.key)}
        className={`w-full text-center text-[9px] font-bold tracking-wider flex items-center justify-center gap-0.5 transition-colors ${
          active ? "text-white" : "text-gray-600 hover:text-gray-400"
        }`}
      >
        {def.label}
        {active && (
          sort.dir === "desc"
            ? <ChevronDown className="w-2.5 h-2.5" />
            : <ChevronUp   className="w-2.5 h-2.5" />
        )}
      </button>
    );
  }

  return (
    <div className="mb-3 rounded-xl overflow-hidden border border-[#0f2d4a]">
      {/* Header */}
      <div
        className="grid items-center gap-x-4 px-4 py-2.5 bg-[#0a1e35]"
        style={{ gridTemplateColumns: statCols(statDefs.length) }}
      >
        <div className="flex justify-center">
          <span
            className="text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded"
            style={{ color: teamColor, backgroundColor: teamColor + "22" }}
          >
            {pos}
          </span>
        </div>
        <span className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">
          {POS_LABEL[pos]}{" "}
          <span className="text-gray-700 font-normal">{players.length}</span>
        </span>
        {statDefs.map((def) => (
          <ColBtn key={def.key} def={def} />
        ))}
      </div>

      {/* Player rows */}
      <div className="bg-[#071e38]/60">
        {sorted.map((p) => (
          <PlayerRow
            key={p.number}
            player={p}
            statDefs={statDefs}
            sortKey={sort.col}
            teamColor={teamColor}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary card
// ─────────────────────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
}: {
  label:     string;
  value:     string;
  sub?:      string;
}) {
  return (
    <div className="bg-[#071e38]/80 border border-[#1a4a7a] rounded-xl p-4 text-center">
      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-white font-bold text-lg leading-tight truncate">{value}</p>
      {sub && <p className="text-gray-600 text-[10px] mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function PlayerDashboard({
  teamCode,
  onClose,
}: {
  teamCode: string | null;
  onClose:  () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const squad = teamCode ? SQUADS[teamCode]                            : null;
  const team  = teamCode ? ALL_TEAMS.find((t) => t.code === teamCode) : null;
  const color = teamCode ? (TEAM_COLORS[teamCode] ?? "#3b82f6")       : "#3b82f6";

  const summary = useMemo(() => {
    if (!squad) return null;
    const p       = squad.players;
    const avgAge  = (p.reduce((s, pl) => s + pl.age, 0) / p.length).toFixed(1);
    const goals        = p.reduce((s, pl) => s + (pl.stats?.goals       ?? 0), 0);
    const cleanSheets  = p.reduce((s, pl) => s + (pl.stats?.cleanSheets ?? 0), 0);
    return { avgAge, goals, cleanSheets };
  }, [squad]);

  if (teamCode == null) return null;

  const shell = (children: React.ReactNode) => (
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
        className="relative bg-[#020d1c] border border-[#1a4a7a] sm:rounded-2xl w-full sm:max-w-5xl max-h-screen sm:max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div
          className="h-1 w-full rounded-t-2xl flex-shrink-0"
          style={{ background: `linear-gradient(to right, ${color}, ${color}44, transparent)` }}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sticky top-3 float-right mr-7 z-10 w-9 h-9 inline-flex items-center justify-center rounded-full bg-[#071e38]/90 border border-[#1a4a7a] text-gray-300 hover:text-white hover:border-white/30 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </motion.div>
    </div>
  );

  if (!squad || !team || !summary) {
    return shell(
      <div className="flex items-center justify-center py-24 text-gray-500 text-sm">
        Squad not yet announced.
      </div>,
    );
  }

  const byPos = (pos: string) => squad.players.filter((p) => p.position === pos);

  return shell(
    <div className="px-4 sm:px-8 py-8">
      {/* ── Team header ── */}
      <div
        className="flex items-center gap-5 mb-8 pb-6 border-b"
        style={{ borderBottomColor: color + "33" }}
      >
        <span className="text-6xl sm:text-7xl leading-none flex-shrink-0 drop-shadow-lg">
          {team.flag}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight truncate">
            {team.name}
          </h2>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-gray-400 text-sm">
              Coach: <span className="text-gray-200 font-semibold">{squad.coach}</span>
            </span>
            <span
              className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded border"
              style={{ color, borderColor: color + "55", backgroundColor: color + "18" }}
            >
              {team.confederation}
            </span>
            <span className="text-gray-600 text-xs">FIFA #{team.fifaRank}</span>
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-gray-500 text-xs uppercase tracking-wider">WC 2026 Stats</span>
          <span className="text-gray-700 text-[10px]">Updates as matches are played</span>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <SummaryCard label="Squad Size"   value={String(squad.players.length)} />
        <SummaryCard label="Average Age"  value={summary.avgAge} />
        <SummaryCard label="WC Goals"        value={String(summary.goals)} />
        <SummaryCard label="Clean Sheets"   value={String(summary.cleanSheets)} />
      </div>

      {/* ── Position groups ── */}
      {(["GK", "DEF", "MID", "FWD"] as const).map((pos) => (
        <PositionGroup
          key={pos}
          pos={pos}
          players={byPos(pos)}
          teamColor={color}
        />
      ))}

      {/* ── Legend ── */}
      <div className="mt-6 pb-2 border-t border-[#0f2d4a] pt-4">
        <p className="text-gray-600 text-[9px] uppercase tracking-widest mb-3">Stat Legend</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5">
          {[
            { label: "AP",  title: "Appearances"     },
            { label: "MIN", title: "Minutes Played"  },
            { label: "G",   title: "Goals"           },
            { label: "A",   title: "Assists"         },
            { label: "SV",  title: "Saves"           },
            { label: "CS",  title: "Clean Sheets"    },
            { label: "GC",  title: "Goals Conceded"  },
            { label: "TKL", title: "Tackles"         },
            { label: "INT", title: "Interceptions"   },
            { label: "KP",  title: "Key Passes"      },
            { label: "DRB", title: "Dribbles"        },
            { label: "SH",  title: "Shots"           },
            { label: "SOT", title: "Shots on Target" },
          ].map(({ label, title }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[9px] font-black tracking-wider text-gray-300 w-7 flex-shrink-0">
                {label}
              </span>
              <span className="text-[10px] text-gray-600">{title}</span>
            </div>
          ))}
        </div>
        <p className="text-gray-700 text-[10px] text-center mt-4">
          WC 2026 tournament stats only · Updates once the group stage begins
        </p>
      </div>
    </div>,
  );
}
