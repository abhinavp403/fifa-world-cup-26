"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Users,
  Target,
  Shield,
  Zap,
  ArrowRightLeft,
  AlertCircle,
  Loader2,
  ChevronDown,
  X,
} from "lucide-react";

import type {
  MatchPayload,
  MatchEvent,
  MatchPlayer,
  MatchSide,
  MatchFormationPlayer,
} from "@/app/api/match/route";

import { GROUPS, TEAM_COLORS, TEAM_SECONDARY_COLORS } from "@/lib/worldcup";

function resolveTeamColors(name: string): { primary: string; secondary: string } {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const t = norm(name);
  for (const g of GROUPS) {
    for (const team of g.teams) {
      const n = norm(team.name);
      if (n === t || t.includes(n) || n.includes(t)) {
        return {
          primary:   TEAM_COLORS[team.code]           ?? "#3b82f6",
          secondary: TEAM_SECONDARY_COLORS[team.code] ?? "#f0f0f0",
        };
      }
    }
  }
  return { primary: "#3b82f6", secondary: "#f0f0f0" };
}

function hexDistance(a: string, b: string): number {
  const c = (h: string, o: number) => parseInt(h.slice(o, o + 2), 16);
  const [r1, g1, b1] = [c(a, 1), c(a, 3), c(a, 5)];
  const [r2, g2, b2] = [c(b, 1), c(b, 3), c(b, 5)];
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

const CLASH_THRESHOLD = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Tiny presentational primitives
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  homeValue,
  awayValue,
  unit = "",
}: {
  icon: React.ElementType;
  label: string;
  homeValue: number | string;
  awayValue: number | string;
  unit?: string;
}) {
  const h = typeof homeValue === "number" ? homeValue : parseFloat(String(homeValue)) || 0;
  const a = typeof awayValue === "number" ? awayValue : parseFloat(String(awayValue)) || 0;
  const homeWins = h > a;
  const awayWins = a > h;

  return (
    <div className="bg-[#0f2d4a]/60 border border-[#1a4a7a] rounded-lg p-3">
      <div className="flex items-center justify-center gap-2 mb-2.5">
        <Icon className="w-4 h-4 text-gray-300" />
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div
          className={`text-lg md:text-xl font-bold leading-none ${
            homeWins ? "text-blue-300" : "text-white/70"
          }`}
        >
          {homeValue}
          {unit && <span className="text-xs text-gray-500 ml-0.5">{unit}</span>}
        </div>
        <div className="text-gray-600 text-xs">vs</div>
        <div
          className={`text-lg md:text-xl font-bold leading-none ${
            awayWins ? "text-rose-300" : "text-white/70"
          }`}
        >
          {awayValue}
          {unit && <span className="text-xs text-gray-500 ml-0.5">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

const COMPARISON_COLS = "3rem 1fr 7.5rem 1fr 3rem";

function ComparisonRow({
  label,
  homeValue,
  awayValue,
  homeColor,
  awayColor,
  unit = "",
}: {
  label: string;
  homeValue: number;
  awayValue: number;
  homeColor: string;
  awayColor: string;
  unit?: string;
}) {
  const total = homeValue + awayValue;
  const homePct = total > 0 ? (homeValue / total) * 100 : 50;
  const awayPct = total > 0 ? (awayValue / total) * 100 : 50;
  const homeWins = homeValue > awayValue;
  const awayWins = awayValue > homeValue;

  return (
    <div
      className="grid items-center gap-x-2 py-0.5"
      style={{ gridTemplateColumns: COMPARISON_COLS }}
    >
      {/* Home value */}
      <div
        className="text-right text-base font-black tabular-nums tracking-tight leading-none"
        style={{ color: homeWins ? homeColor : "#4b5563" }}
      >
        {homeValue}
        {unit && <span className="text-[10px] font-bold">{unit}</span>}
      </div>

      {/* Home bar — right-aligned, grows inward from center label */}
      <div className="min-w-0 flex justify-end h-1.5 rounded-full bg-[#0a1e35] overflow-hidden">
        <div
          style={{
            width: `${homePct}%`,
            backgroundColor: homeWins ? homeColor : `${homeColor}33`,
          }}
          className="h-full rounded-full transition-all duration-700"
        />
      </div>

      {/* Centre label */}
      <div className="text-center text-[9px] font-bold tracking-widest text-gray-500 uppercase truncate px-1">
        {label}
      </div>

      {/* Away bar — left-aligned, grows inward from center label */}
      <div className="min-w-0 flex justify-start h-1.5 rounded-full bg-[#0a1e35] overflow-hidden">
        <div
          style={{
            width: `${awayPct}%`,
            backgroundColor: awayWins ? awayColor : `${awayColor}33`,
          }}
          className="h-full rounded-full transition-all duration-700"
        />
      </div>

      {/* Away value */}
      <div
        className="text-left text-base font-black tabular-nums tracking-tight leading-none"
        style={{ color: awayWins ? awayColor : "#4b5563" }}
      >
        {awayValue}
        {unit && <span className="text-[10px] font-bold">{unit}</span>}
      </div>
    </div>
  );
}

function positionGroup(pos: string): "GK" | "DEF" | "MID" | "FWD" | "OTHER" {
  const p = pos.toUpperCase();
  if (p === "G" || p.includes("GK")) return "GK";
  if (p === "D" || /CB|RB|LB|RWB|LWB/.test(p)) return "DEF";
  if (p === "M" || /CM|DM|AM|RM|LM/.test(p)) return "MID";
  if (p === "F" || /ST|CF|RW|LW|FW/.test(p)) return "FWD";
  return "OTHER";
}

function ratingBadgeStyle(rating: number | null): string {
  if (rating == null) return "bg-gray-700/60 text-gray-500";
  if (rating >= 8.0) return "bg-emerald-500 text-white";
  if (rating >= 7.0) return "bg-lime-500 text-gray-900";
  if (rating >= 6.5) return "bg-amber-400 text-gray-900";
  if (rating >= 6.0) return "bg-orange-500 text-white";
  return "bg-rose-600 text-white";
}

type PosType = "GK" | "DEF" | "MID" | "FWD";

type ColDef = { abbr: string; get: (p: MatchPlayer) => string };

const POSITION_COLS: Record<PosType, ColDef[]> = {
  GK: [
    { abbr: "SV",  get: p => String(p.saves) },
    { abbr: "SV%", get: p => { const t = p.saves + p.goalsConceded; return t > 0 ? `${Math.round((p.saves / t) * 100)}%` : "—"; } },
    { abbr: "GC",  get: p => String(p.goalsConceded) },
  ],
  DEF: [
    { abbr: "P",  get: p => String(p.passes) },
    { abbr: "P%", get: p => p.passAccuracy != null ? `${p.passAccuracy}%` : "—" },
    { abbr: "T",  get: p => String(p.tackles) },
    { abbr: "I",  get: p => String(p.interceptions) },
    { abbr: "D",  get: p => String(p.duelsWon) },
    { abbr: "KP", get: p => String(p.keyPasses) },
  ],
  MID: [
    { abbr: "P",  get: p => String(p.passes) },
    { abbr: "P%", get: p => p.passAccuracy != null ? `${p.passAccuracy}%` : "—" },
    { abbr: "KP", get: p => String(p.keyPasses) },
    { abbr: "T",  get: p => String(p.tackles) },
    { abbr: "I",  get: p => String(p.interceptions) },
    { abbr: "D",  get: p => String(p.duelsWon) },
  ],
  FWD: [
    { abbr: "Sh", get: p => String(p.shots) },
    { abbr: "G",  get: p => String(p.goals) },
    { abbr: "A",  get: p => String(p.assists) },
    { abbr: "KP", get: p => String(p.keyPasses) },
    { abbr: "Dr", get: p => String(p.dribbles) },
    { abbr: "P%", get: p => p.passAccuracy != null ? `${p.passAccuracy}%` : "—" },
  ],
};

function CompactPlayerRow({
  player,
  posType,
}: {
  player: MatchPlayer;
  posType: PosType;
}) {
  const cols = POSITION_COLS[posType];
  const colW = posType === "GK" ? "w-10" : "w-8";

  return (
    <div className="flex items-center gap-1.5 px-2 py-2 border-b border-[#0d2540]/60 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-white text-sm font-semibold truncate">{player.name}</span>
          {player.substitute && (
            <span className="text-[9px] text-gray-600">(sub)</span>
          )}
          {player.cards.yellow > 0 &&
            Array.from({ length: player.cards.yellow }).map((_, i) => (
              <span key={i} className="text-[11px] leading-none">🟨</span>
            ))}
          {player.cards.red > 0 && (
            <span className="text-[11px] leading-none">🟥</span>
          )}
          {player.goals > 0 &&
            Array.from({ length: player.goals }).map((_, i) => (
              <span key={i} className="text-[11px] leading-none">⚽</span>
            ))}
          {player.assists > 0 &&
            Array.from({ length: player.assists }).map((_, i) => (
              <span key={i} className="text-[10px] leading-none">👟</span>
            ))}
        </div>
        <div className="text-[10px] text-gray-600 mt-0.5">
          {player.position} · #{player.number} · {player.minutes}'
        </div>
      </div>
      <div className="flex items-center flex-shrink-0">
        {cols.map((col) => (
          <span
            key={col.abbr}
            className={`${colW} text-center text-xs tabular-nums text-gray-400`}
          >
            {col.get(player)}
          </span>
        ))}
      </div>
      <div
        className={`${ratingBadgeStyle(player.rating)} text-[11px] font-bold w-11 text-center py-1 rounded-lg flex-shrink-0`}
      >
        {player.rating?.toFixed(1) ?? "—"}
      </div>
    </div>
  );
}

function CompactPositionGroup({
  title,
  players,
  posType,
}: {
  title: string;
  players: MatchPlayer[];
  posType: PosType;
}) {
  if (players.length === 0) return null;

  const cols = POSITION_COLS[posType];
  const colW = posType === "GK" ? "w-10" : "w-8";

  return (
    <div className="mb-2 rounded-xl overflow-hidden border border-[#0f2d4a]">
      <div className="flex items-center justify-between px-2 py-1.5 bg-[#0a1e35]">
        <span className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">
          {title}{" "}
          <span className="text-gray-600 font-normal">{players.length}</span>
        </span>
        <div className="flex items-center">
          {cols.map((c) => (
            <span key={c.abbr} className={`${colW} text-center text-[9px] font-bold text-gray-600`}>
              {c.abbr}
            </span>
          ))}
          <span className="w-11 text-center text-[9px] font-bold text-gray-600">RTG</span>
        </div>
      </div>
      <div className="bg-[#071e38]/60">
        {players.map((p) => (
          <CompactPlayerRow key={p.id} player={p} posType={posType} />
        ))}
      </div>
    </div>
  );
}

function TeamRatingsPanel({
  side,
  teamColor,
}: {
  side: MatchSide;
  teamColor: string;
}) {

  const starters = side.players.filter((p) => !p.substitute);
  const activeSubs = side.players.filter((p) => p.substitute && p.minutes > 0);

  const byPos = (pos: "GK" | "DEF" | "MID" | "FWD") =>
    starters.filter((p) => positionGroup(p.position) === pos);

  const rated = side.players.filter((p) => p.rating != null && p.minutes > 0);
  const avg =
    rated.length > 0
      ? (rated.reduce((s, p) => s + (p.rating ?? 0), 0) / rated.length).toFixed(1)
      : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: teamColor }} />
          <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: teamColor }}>
            {side.team.name}
          </span>
        </div>
        {avg && (
          <span className="text-gray-500 text-xs">
            AVG <span className="text-white font-bold">{avg}</span>
          </span>
        )}
      </div>
      <CompactPositionGroup title="Goalkeepers" players={byPos("GK")} posType="GK" />
      <CompactPositionGroup title="Defenders" players={byPos("DEF")} posType="DEF" />
      <CompactPositionGroup title="Midfielders" players={byPos("MID")} posType="MID" />
      <CompactPositionGroup title="Forwards" players={byPos("FWD")} posType="FWD" />
      {activeSubs.length > 0 && (
        <CompactPositionGroup title="Substitutes" players={activeSubs} posType="MID" />
      )}
    </div>
  );
}

function ColumnLegend() {
  const sections: Array<{ pos: string; items: [string, string][] }> = [
    {
      pos: "GK",
      items: [["SV","Saves"],["SV%","Save %"],["GC","Goals Conc."]],
    },
    {
      pos: "DEF",
      items: [["P","Passes"],["P%","Pass Acc"],["T","Tackles"],["I","Interceptions"],["D","Duels Won"],["KP","Key Passes"]],
    },
    {
      pos: "MID",
      items: [["P","Passes"],["P%","Pass Acc"],["KP","Key Passes"],["T","Tackles"],["I","Interceptions"],["D","Duels Won"]],
    },
    {
      pos: "FWD",
      items: [["Sh","Shots"],["G","Goals"],["A","Assists"],["KP","Key Passes"],["Dr","Dribbles"],["P%","Pass Acc"]],
    },
  ];
  return (
    <div className="space-y-1 text-[10px]">
      {sections.map(({ pos, items }) => (
        <div key={pos} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-gray-600 font-bold tracking-wider w-7 flex-shrink-0">{pos}</span>
          {items.map(([abbr, full]) => (
            <span key={abbr} className="text-gray-600">
              <span className="text-gray-400 font-bold">{abbr}</span> {full}
            </span>
          ))}
        </div>
      ))}
      <div className="flex items-baseline gap-x-3 pt-0.5">
        <span className="text-gray-600 font-bold tracking-wider w-7 flex-shrink-0">ALL</span>
        <span className="text-gray-600"><span className="text-gray-400 font-bold">RTG</span> Rating</span>
      </div>
    </div>
  );
}

function RatingLegend() {
  const items: Array<{ label: string; cls: string }> = [
    { label: "8.0+", cls: "bg-emerald-500" },
    { label: "7.0+", cls: "bg-lime-500" },
    { label: "6.5+", cls: "bg-amber-400" },
    { label: "6.0+", cls: "bg-orange-500" },
    { label: "<6.0", cls: "bg-rose-600" },
  ];
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {items.map(({ label, cls }) => (
        <div key={label} className="flex items-center gap-1">
          <span className={`w-2.5 h-2.5 rounded-sm ${cls} flex-shrink-0`} />
          <span className="text-[10px] text-gray-500">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Formation pitch
// ─────────────────────────────────────────────────────────────────────────────

function FormationPitch({
  side,
  teamColor,
}: {
  side: MatchSide;
  teamColor: string;
}) {
  const fill = teamColor;
  const stroke = teamColor + "aa";

  const counts = useMemo(() => {
    const out = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const p of side.startXI) {
      if (p.pos === "G") out.GK++;
      else if (p.pos === "D") out.DEF++;
      else if (p.pos === "M") out.MID++;
      else if (p.pos === "F") out.FWD++;
    }
    return out;
  }, [side.startXI]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div
        className="flex items-center justify-between pb-3 border-b"
        style={{ borderBottomColor: teamColor + "33" }}
      >
        <h5 className="font-bold text-base" style={{ color: teamColor }}>{side.team.name}</h5>
        <span
          className="text-white text-sm font-bold px-3 py-1.5 rounded-lg"
          style={{ backgroundColor: teamColor + "66" }}
        >
          {side.formation}
        </span>
      </div>

      <svg
        viewBox="0 0 100 100"
        className="w-full bg-gradient-to-b from-[#0f4a3a] to-[#071e38] rounded-xl border aspect-square shadow-lg"
        style={{ borderColor: teamColor + "4d" }}
      >
        <rect width="100" height="100" fill="none" stroke="#3ba68f" strokeWidth="0.8" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#3ba68f" strokeWidth="0.8" />
        <circle cx="50" cy="50" r="10" fill="none" stroke="#3ba68f" strokeWidth="0.8" />
        <circle cx="50" cy="50" r="1" fill="#3ba68f" />
        <rect x="35" y="0" width="30" height="14" fill="none" stroke="#3ba68f" strokeWidth="0.8" />
        <rect x="35" y="86" width="30" height="14" fill="none" stroke="#3ba68f" strokeWidth="0.8" />

        {side.startXI.map((p) => {
          const stats = side.players.find((sp) => sp.id === p.id);
          const flags: string[] = [];
          if (stats) {
            if (stats.goals > 0) flags.push("⚽");
            if (stats.assists > 0) flags.push("👟");
            if (stats.cards.red > 0) flags.push("🟥");
            else if (stats.cards.yellow > 0) flags.push("🟨");
            if (!stats.substitute && stats.minutes < 90 && stats.minutes > 0) {
              flags.push("🔄");
            }
          }
          return (
            <g key={p.id}>
              <circle cx={p.x} cy={p.y} r="3.2" fill={fill} stroke={stroke} strokeWidth="0.8" opacity="0.95" />
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dy="0.35em"
                className="text-[4.5px] fill-white font-bold"
              >
                {p.number}
              </text>
              <text
                x={p.x}
                y={p.y + 6}
                textAnchor="middle"
                className="text-[3px] fill-white/80 font-medium"
              >
                {p.name.split(" ").pop()}
              </text>
              {flags.map((icon, idx) => (
                <text
                  key={idx}
                  x={p.x + 4 + idx * 3.2}
                  y={p.y - 2.5}
                  textAnchor="middle"
                  className="text-[3.2px]"
                >
                  {icon}
                </text>
              ))}
            </g>
          );
        })}
      </svg>

      <div className="flex gap-2 flex-wrap">
        {(["GK", "DEF", "MID", "FWD"] as const).map((k) => (
          <div
            key={k}
            className="border rounded-lg px-3 py-2 text-xs"
            style={{
              backgroundColor: teamColor + "33",
              borderColor: teamColor + "4d",
            }}
          >
            {k}: <span className="text-white font-bold">{counts[k]}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Key moments timeline
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_CONFIG = {
  goal: {
    icon: "⚽",
    label: "Goal",
    iconBg: "bg-emerald-500/25 ring-1 ring-emerald-500/40",
    rowBg: "bg-emerald-500/8 border border-emerald-500/20",
    minuteBg: "bg-emerald-500/20 border-emerald-500/40 text-emerald-200",
  },
  yellowCard: {
    icon: "🟨",
    label: "Yellow Card",
    iconBg: "bg-amber-500/20 ring-1 ring-amber-500/30",
    rowBg: "bg-transparent border border-transparent",
    minuteBg: "bg-[#0f2d4a] border-[#1a4a7a] text-gray-300",
  },
  redCard: {
    icon: "🟥",
    label: "Red Card",
    iconBg: "bg-red-600/25 ring-1 ring-red-500/40",
    rowBg: "bg-red-600/8 border border-red-500/20",
    minuteBg: "bg-red-600/20 border-red-500/40 text-red-200",
  },
  substitution: {
    icon: "🔄",
    label: "Substitution",
    iconBg: "bg-sky-500/15 ring-1 ring-sky-500/20",
    rowBg: "bg-transparent border border-transparent",
    minuteBg: "bg-[#0f2d4a] border-[#1a4a7a] text-gray-300",
  },
} as const;

type EventType = keyof typeof EVENT_CONFIG;

function getEventConfig(type: string) {
  return EVENT_CONFIG[type as EventType] ?? {
    icon: "•",
    label: type,
    iconBg: "bg-gray-500/15",
    rowBg: "bg-transparent border border-transparent",
    minuteBg: "bg-[#0f2d4a] border-[#1a4a7a] text-gray-300",
  };
}

function toCode(name: string): string {
  // "Manchester City" → "MAN", "Crystal Palace" → "CRY", "Argentina" → "ARG"
  return name.slice(0, 3).toUpperCase();
}

function KeyMomentsTimeline({
  events,
  homeTeamId,
  homeName,
  awayName,
  homeColor,
  awayColor,
}: {
  events: MatchEvent[];
  homeTeamId: number;
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
}) {
  if (events.length === 0) {
    return <div className="text-gray-400 text-sm">No events recorded for this fixture.</div>;
  }

  const homeCode = toCode(homeName);
  const awayCode = toCode(awayName);

  const maxMinute = Math.max(90, ...events.map((e) => e.minute + (e.extra ?? 0)));
  const pct = (minute: number, extra?: number | null) =>
    Math.min(((minute + (extra ?? 0) * 0.5) / maxMinute) * 100, 96);

  const homeEvents = events.filter((e) => e.teamId === homeTeamId);
  const awayEvents = events.filter((e) => e.teamId !== homeTeamId);

  // Label column width so team codes sit flush left of the bar.
  const LABEL_W = "w-9";

  return (
    <div className="space-y-6">
      <h3 className="text-white text-xl font-bold">Key Moments</h3>

      {/* ── Visual timeline bar ── */}
      <div className="select-none">
        {/* Home markers above bar — label on the left */}
        <div className="flex items-end gap-1">
          <span
            className={`${LABEL_W} flex-shrink-0 text-[10px] font-bold tracking-wider text-right pb-0.5`}
            style={{ color: homeColor }}
          >
            {homeCode}
          </span>
          <div className="relative h-10 flex-1 mb-0.5">
            {homeEvents.map((e, i) => (
              <div
                key={i}
                style={{ left: `${pct(e.minute, e.extra)}%` }}
                className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center"
              >
                <span
                  className="text-[10px] font-bold tabular-nums leading-none mb-0.5"
                  style={{ color: homeColor + "e6" }}
                >
                  {e.minute}{e.extra ? `+${e.extra}` : ""}'
                </span>
                <span className="text-sm leading-none">{getEventConfig(e.type).icon}</span>
                <div className="w-px h-2 mt-0.5" style={{ backgroundColor: homeColor + "4d" }} />
              </div>
            ))}
          </div>
        </div>

        {/* The bar — padded left to align with marker area */}
        <div className="flex items-center gap-1">
          <div className={`${LABEL_W} flex-shrink-0`} />
          <div className="relative h-2.5 rounded-full bg-[#0f2d4a] border border-[#1a4a7a] overflow-visible flex-1">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `linear-gradient(to right, ${homeColor}33, transparent, ${awayColor}33)`,
              }}
            />
            <div
              style={{ left: `${(45 / maxMinute) * 100}%` }}
              className="absolute top-0 bottom-0 w-px bg-white/15"
            />
            {events.map((e, i) => {
              const isHome = e.teamId === homeTeamId;
              return (
                <div
                  key={i}
                  style={{
                    left: `${pct(e.minute, e.extra)}%`,
                    backgroundColor: isHome ? homeColor : awayColor,
                    borderColor: "white",
                  }}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 z-10"
                />
              );
            })}
          </div>
        </div>

        {/* Away markers below bar — label on the left */}
        <div className="flex items-start gap-1">
          <span
            className={`${LABEL_W} flex-shrink-0 text-[10px] font-bold tracking-wider text-right pt-0.5`}
            style={{ color: awayColor }}
          >
            {awayCode}
          </span>
          <div className="relative h-10 flex-1 mt-0.5">
            {awayEvents.map((e, i) => (
              <div
                key={i}
                style={{ left: `${pct(e.minute, e.extra)}%` }}
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
              >
                <div className="w-px h-2 mb-0.5" style={{ backgroundColor: awayColor + "4d" }} />
                <span className="text-sm leading-none">{getEventConfig(e.type).icon}</span>
                <span
                  className="text-[10px] font-bold tabular-nums leading-none mt-0.5"
                  style={{ color: awayColor + "e6" }}
                >
                  {e.minute}{e.extra ? `+${e.extra}` : ""}'
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Axis labels — aligned to bar (not label column) */}
        <div className="flex gap-1">
          <div className={`${LABEL_W} flex-shrink-0`} />
          <div className="flex justify-between text-[10px] text-gray-600 mt-1 flex-1">
            <span>0'</span>
            <span>HT 45'</span>
            <span>{maxMinute}'</span>
          </div>
        </div>
      </div>

      {/* ── Two-column match facts ── */}
      <div className="pt-2 border-t border-[#0f2d4a]">
        {/* Column headers — team names instead of Home / Away */}
        <div className="grid grid-cols-[1fr_56px_1fr] gap-2 pb-2 text-[10px] font-bold tracking-widest text-gray-500 uppercase px-1">
          <span className="text-right truncate" style={{ color: homeColor + "b3" }}>{homeName}</span>
          <span className="text-center">Min</span>
          <span className="truncate" style={{ color: awayColor + "b3" }}>{awayName}</span>
        </div>

        {(() => {
          // Find the index of the first second-half event to insert the HT divider.
          const htIndex = events.findIndex((e) => e.minute > 45);
          const rows: React.ReactNode[] = [];

          events.forEach((e, i) => {
            // Insert HT divider before the first second-half event.
            if (i === htIndex) {
              rows.push(
                <div key="ht-divider" className="grid grid-cols-[1fr_56px_1fr] gap-2 items-center py-1 px-2 my-1">
                  <div className="h-px bg-white/10" />
                  <div className="flex justify-center">
                    <span className="text-[9px] font-bold tracking-widest text-gray-500 uppercase bg-[#0f2d4a] border border-[#1a4a7a] px-2 py-0.5 rounded-full whitespace-nowrap">
                      Half Time
                    </span>
                  </div>
                  <div className="h-px bg-white/10" />
                </div>,
              );
            }

            const isHome = e.teamId === homeTeamId;
            const cfg = getEventConfig(e.type);
            const isGoal = e.type === "goal";
            const isSub = e.type === "substitution";

            const eventContent = (side: "home" | "away") => {
              const align = side === "home" ? "text-right" : "text-left";
              return (
                <div className="min-w-0">
                  {isSub ? (
                    <>
                      <p className={`text-white font-semibold text-xs leading-tight truncate ${align}`}>
                        <span className="text-emerald-400 font-bold">↑</span> {e.player}
                      </p>
                      {e.assist && (
                        <p className={`text-gray-400 text-xs leading-tight truncate mt-0.5 ${align}`}>
                          <span className="text-rose-400 font-bold">↓</span> {e.assist}
                        </p>
                      )}
                    </>
                  ) : isGoal ? (
                    <>
                      <p className={`text-white font-semibold text-sm leading-tight truncate ${align}`}>
                        {e.player}
                      </p>
                      {e.assist && (
                        <p className={`text-gray-400 text-xs mt-0.5 truncate ${align}`}>
                          Assist: {e.assist}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className={`text-white font-semibold text-sm leading-tight truncate ${align}`}>
                        {e.player}
                      </p>
                      <p className={`text-gray-500 text-xs mt-0.5 ${align}`}>{cfg.label}</p>
                    </>
                  )}
                </div>
              );
            };

            rows.push(
              <motion.div
                key={`${e.minute}-${i}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`grid grid-cols-[1fr_56px_1fr] gap-2 items-center py-2.5 px-2 rounded-xl ${cfg.rowBg} transition-colors`}
              >
                {/* Home side */}
                {isHome ? (
                  <div className="flex items-center gap-2 justify-end">
                    {eventContent("home")}
                    <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-base ${cfg.iconBg}`}>
                      {cfg.icon}
                    </div>
                  </div>
                ) : (
                  <div />
                )}

                {/* Centre minute bubble */}
                <div className="flex justify-center">
                  <span className={`text-[11px] font-bold tabular-nums px-2 py-1 rounded-full border whitespace-nowrap ${cfg.minuteBg}`}>
                    {e.minute}{e.extra ? `+${e.extra}` : ""}'
                  </span>
                </div>

                {/* Away side */}
                {!isHome ? (
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-base ${cfg.iconBg}`}>
                      {cfg.icon}
                    </div>
                    {eventContent("away")}
                  </div>
                ) : (
                  <div />
                )}
              </motion.div>,
            );
          });

          return rows;
        })()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function MatchAnalytics({
  fixtureId,
  onClose,
}: {
  fixtureId: number | null;
  onClose?: () => void;
}) {
  const [data, setData] = useState<MatchPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (fixtureId == null) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/match?id=${fixtureId}`);
        const json = await res.json();
        if (cancelled) return;
        if (!json.live) {
          setError(json.error ?? "No match data available");
        } else {
          setData(json as MatchPayload);
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  // Lock body scroll + listen for ESC while the dialog is open.
  useEffect(() => {
    if (fixtureId == null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [fixtureId, onClose]);

  if (fixtureId == null) return null;

  const dialogShell = (children: React.ReactNode) => (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-6"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close analytics"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      {/* Dialog card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative bg-[#020d1c] border border-[#1a4a7a] sm:rounded-2xl w-full sm:max-w-6xl max-h-screen sm:max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="sticky top-3 float-right mr-7 z-10 w-9 h-9 inline-flex items-center justify-center rounded-full bg-[#071e38]/90 border border-[#1a4a7a] text-gray-300 hover:text-white hover:border-white/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {children}
      </motion.div>
    </div>
  );

  if (loading) {
    return dialogShell(
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Fetching latest match data…</p>
      </div>,
    );
  }

  if (error || !data) {
    return dialogShell(
      <div className="max-w-3xl mx-auto bg-[#071e38]/80 border border-rose-500/30 rounded-2xl p-6 text-center m-6">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
        <p className="text-white font-semibold mb-1">Match data unavailable</p>
        <p className="text-gray-400 text-sm">
          {error ?? "Make sure API_FOOTBALL_KEY is set in .env.local."}
        </p>
      </div>,
    );
  }

  const { home, away, events, venue, date, competition, round } = data;

  const homeColors = resolveTeamColors(home.team.name);
  const awayColors = resolveTeamColors(away.team.name);
  const homeColor = homeColors.primary;
  const awayColor =
    hexDistance(homeColors.primary, awayColors.primary) < CLASH_THRESHOLD
      ? awayColors.secondary
      : awayColors.primary;

  // Aggregated stats not provided at team level — sum from per-player rows.
  const sumFromPlayers = (side: MatchSide, key: keyof MatchPlayer) =>
    side.players.reduce((acc, p) => acc + ((p[key] as number) ?? 0), 0);

  const tackles = {
    home: sumFromPlayers(home, "tackles"),
    away: sumFromPlayers(away, "tackles"),
  };
  const intercepts = {
    home: sumFromPlayers(home, "interceptions"),
    away: sumFromPlayers(away, "interceptions"),
  };
  const dribbles = {
    home: sumFromPlayers(home, "dribbles"),
    away: sumFromPlayers(away, "dribbles"),
  };
  const duelsWon = {
    home: sumFromPlayers(home, "duelsWon"),
    away: sumFromPlayers(away, "duelsWon"),
  };

  return dialogShell(
    <div className="px-4 sm:px-6 py-8 sm:py-10">
      <div className="max-w-7xl mx-auto">
        {/* Match header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="text-gray-500 text-xs uppercase tracking-wider text-center mb-3">
            {competition} · {round}
          </div>
          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="text-center flex-1">
              <div className="flex justify-center mb-2">
                <Image
                  src={home.team.logo}
                  alt={home.team.name}
                  width={48}
                  height={48}
                  className="h-12 w-12"
                  unoptimized
                />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-white mb-2">
                {home.team.name}
              </div>
              <div className="text-5xl font-bold" style={{ color: homeColor }}>{home.stats.goals}</div>
            </div>
            <div className="text-gray-500 text-2xl font-bold">VS</div>
            <div className="text-center flex-1">
              <div className="flex justify-center mb-2">
                <Image
                  src={away.team.logo}
                  alt={away.team.name}
                  width={48}
                  height={48}
                  className="h-12 w-12"
                  unoptimized
                />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-white mb-2">
                {away.team.name}
              </div>
              <div className="text-5xl font-bold" style={{ color: awayColor }}>{away.stats.goals}</div>
            </div>
          </div>
          <p className="text-gray-400 text-center text-sm">
            {venue ?? "Unknown venue"} ·{" "}
            {new Date(date).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </motion.div>

        {/* Key stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8"
        >
          <StatCard
            icon={Target}
            label="Shots"
            homeValue={home.stats.shots}
            awayValue={away.stats.shots}
          />
          <StatCard
            icon={Zap}
            label="On Target"
            homeValue={home.stats.shotsOnTarget}
            awayValue={away.stats.shotsOnTarget}
          />
          <StatCard
            icon={Shield}
            label="Possession"
            homeValue={home.stats.possession}
            awayValue={away.stats.possession}
            unit="%"
          />
          <StatCard
            icon={TrendingUp}
            label="Pass Acc"
            homeValue={home.stats.passAccuracy}
            awayValue={away.stats.passAccuracy}
            unit="%"
          />
          <StatCard
            icon={Users}
            label="Key Passes"
            homeValue={home.stats.keyPasses}
            awayValue={away.stats.keyPasses}
          />
        </motion.div>

        {/* Key moments timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#071e38]/80 border border-[#1a4a7a] rounded-2xl p-6 mb-8"
        >
          <KeyMomentsTimeline
            events={events}
            homeTeamId={home.team.id}
            homeName={home.team.name}
            awayName={away.team.name}
            homeColor={homeColor}
            awayColor={awayColor}
          />
        </motion.div>

        {/* Team comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#071e38]/80 border border-[#1a4a7a] rounded-2xl p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white text-xl font-bold">Team Comparison</h3>
          </div>
          {/* Team name headers */}
          <div
            className="grid gap-x-2 mb-3"
            style={{ gridTemplateColumns: COMPARISON_COLS }}
          >
            <div />
            <p className="text-right text-[11px] font-bold tracking-wider truncate" style={{ color: homeColor + "cc" }}>{home.team.name}</p>
            <div />
            <p className="text-left text-[11px] font-bold tracking-wider truncate" style={{ color: awayColor + "cc" }}>{away.team.name}</p>
            <div />
          </div>
          <div className="space-y-2">
            <ComparisonRow label="Possession" homeValue={home.stats.possession} awayValue={away.stats.possession} unit="%" homeColor={homeColor} awayColor={awayColor} />
            <ComparisonRow label="Shots" homeValue={home.stats.shots} awayValue={away.stats.shots} homeColor={homeColor} awayColor={awayColor} />
            <ComparisonRow label="Shots on Target" homeValue={home.stats.shotsOnTarget} awayValue={away.stats.shotsOnTarget} homeColor={homeColor} awayColor={awayColor} />
            <ComparisonRow label="Total Passes" homeValue={home.stats.totalPasses} awayValue={away.stats.totalPasses} homeColor={homeColor} awayColor={awayColor} />
            <ComparisonRow label="Pass Accuracy" homeValue={home.stats.passAccuracy} awayValue={away.stats.passAccuracy} unit="%" homeColor={homeColor} awayColor={awayColor} />
            <ComparisonRow label="Key Passes" homeValue={home.stats.keyPasses} awayValue={away.stats.keyPasses} homeColor={homeColor} awayColor={awayColor} />
            <ComparisonRow label="Tackles" homeValue={tackles.home} awayValue={tackles.away} homeColor={homeColor} awayColor={awayColor} />
            <ComparisonRow label="Interceptions" homeValue={intercepts.home} awayValue={intercepts.away} homeColor={homeColor} awayColor={awayColor} />
            <ComparisonRow label="Dribbles Completed" homeValue={dribbles.home} awayValue={dribbles.away} homeColor={homeColor} awayColor={awayColor} />
            <ComparisonRow label="Duels Won" homeValue={duelsWon.home} awayValue={duelsWon.away} homeColor={homeColor} awayColor={awayColor} />
            <ComparisonRow label="Fouls" homeValue={home.stats.fouls} awayValue={away.stats.fouls} homeColor={homeColor} awayColor={awayColor} />
            <ComparisonRow label="Corners" homeValue={home.stats.corners} awayValue={away.stats.corners} homeColor={homeColor} awayColor={awayColor} />
          </div>
        </motion.div>

        {/* Player ratings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#071e38]/80 border border-[#1a4a7a] rounded-2xl p-6 mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <h3 className="text-white text-xl font-bold">Player Performance Ratings</h3>
            <RatingLegend />
          </div>
          <ColumnLegend />
          <div className="mt-5" />
          <div className="grid lg:grid-cols-2 gap-6">
            <TeamRatingsPanel side={home} teamColor={homeColor} />
            <TeamRatingsPanel side={away} teamColor={awayColor} />
          </div>
        </motion.div>

        {/* Formations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-[#071e38]/80 border border-[#1a4a7a] rounded-2xl p-6 mb-8"
        >
          <h3 className="text-white text-xl font-bold mb-6">Formations</h3>
          <div className="grid lg:grid-cols-2 gap-8">
            <FormationPitch side={home} teamColor={homeColor} />
            <FormationPitch side={away} teamColor={awayColor} />
          </div>
        </motion.div>
      </div>
    </div>,
  );
}
