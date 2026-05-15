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

function ProgressBar({
  label,
  homeValue,
  awayValue,
  unit = "",
}: {
  label: string;
  homeValue: number;
  awayValue: number;
  unit?: string;
}) {
  const total = homeValue + awayValue;
  const homePct = total > 0 ? (homeValue / total) * 100 : 50;
  const awayPct = total > 0 ? (awayValue / total) * 100 : 50;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-500">
          {homeValue} — {awayValue} {unit}
        </span>
      </div>
      <div className="flex gap-1 h-2 rounded-full bg-[#0f2d4a]">
        <div
          className="bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
          style={{ width: `${homePct}%` }}
        />
        <div
          className="bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all"
          style={{ width: `${awayPct}%` }}
        />
      </div>
    </div>
  );
}

function ratingColor(rating: number | null) {
  if (rating == null) return "text-gray-500";
  if (rating >= 8) return "text-green-400";
  if (rating >= 7) return "text-blue-300";
  if (rating >= 6) return "text-yellow-300";
  return "text-rose-300";
}

function PlayerCard({
  player,
  teamColor,
}: {
  player: MatchPlayer;
  teamColor: "blue" | "rose";
}) {
  const borderColor = teamColor === "blue" ? "border-blue-500/30" : "border-rose-500/30";
  const bgColor = teamColor === "blue" ? "from-blue-500/10" : "from-rose-500/10";

  const isKeeper = positionGroup(player.position) === "GK";
  const isAttacker = positionGroup(player.position) === "FWD";

  const stats: Array<{ label: string; value: string | number }> = isKeeper
    ? (() => {
        const totalShotsFaced = player.saves + player.goalsConceded;
        const savePct =
          totalShotsFaced > 0
            ? Math.round((player.saves / totalShotsFaced) * 100)
            : null;
        return [
          { label: "Saves", value: player.saves },
          { label: "Save %", value: savePct != null ? `${savePct}%` : "—" },
          { label: "Goals Cond.", value: player.goalsConceded },
          { label: "Pen. Saved", value: player.penaltiesSaved },
          { label: "Passes", value: player.passes },
          {
            label: "Pass Acc",
            value: player.passAccuracy != null ? `${player.passAccuracy}%` : "—",
          },
        ];
      })()
    : isAttacker
    ? [
        { label: "Passes", value: player.passes },
        {
          label: "Pass Acc",
          value: player.passAccuracy != null ? `${player.passAccuracy}%` : "—",
        },
        { label: "Key Pass", value: player.keyPasses },
        { label: "Shots", value: player.shots },
        { label: "Goals", value: player.goals },
        { label: "Dribbles", value: player.dribbles },
      ]
    : [
        { label: "Passes", value: player.passes },
        {
          label: "Pass Acc",
          value: player.passAccuracy != null ? `${player.passAccuracy}%` : "—",
        },
        { label: "Key Pass", value: player.keyPasses },
        { label: "Tackles", value: player.tackles },
        { label: "Intercepts", value: player.interceptions },
        { label: "Duels Won", value: player.duelsWon },
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-r ${bgColor} to-transparent border ${borderColor} rounded-lg p-4`}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-white font-semibold">
            {player.name}
            {player.substitute && (
              <span className="text-gray-500 text-xs font-normal ml-2">(sub)</span>
            )}
          </div>
          <div className="text-gray-400 text-xs">
            {player.position} · #{player.number} · {player.minutes}'
          </div>
        </div>
        <div className={`text-2xl font-bold ${ratingColor(player.rating)}`}>
          {player.rating?.toFixed(1) ?? "—"}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#0f2d4a]/40 rounded p-2">
            <div className="text-gray-400">{s.label}</div>
            <div className="text-white font-semibold">{s.value}</div>
          </div>
        ))}
      </div>
    </motion.div>
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

function PositionSection({
  label,
  players,
  teamColor,
  defaultOpen = true,
}: {
  label: string;
  players: MatchPlayer[];
  teamColor: "blue" | "rose";
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const headingColor = teamColor === "blue" ? "text-blue-300" : "text-rose-300";

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between ${headingColor} text-sm font-bold mb-3 hover:opacity-80 transition-opacity group`}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          {label}
          <span className="text-gray-500 text-xs font-normal">({players.length})</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <div className="space-y-3">
          {players.map((p) => (
            <PlayerCard key={p.id} player={p} teamColor={teamColor} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayersByPosition({
  players,
  teamColor,
}: {
  players: MatchPlayer[];
  teamColor: "blue" | "rose";
}) {
  const starters = players.filter((p) => !p.substitute);
  const subs = players.filter((p) => p.substitute && p.minutes > 0);

  const groups: Array<{ label: string; list: MatchPlayer[]; defaultOpen?: boolean }> = [
    { label: "Goalkeepers", list: starters.filter((p) => positionGroup(p.position) === "GK") },
    { label: "Defenders", list: starters.filter((p) => positionGroup(p.position) === "DEF") },
    { label: "Midfielders", list: starters.filter((p) => positionGroup(p.position) === "MID") },
    { label: "Attackers", list: starters.filter((p) => positionGroup(p.position) === "FWD") },
    { label: "Substitutes", list: subs, defaultOpen: false },
  ];

  return (
    <div className="space-y-6">
      {groups.map(({ label, list, defaultOpen }) =>
        list.length > 0 ? (
          <PositionSection
            key={label}
            label={label}
            players={list}
            teamColor={teamColor}
            defaultOpen={defaultOpen ?? true}
          />
        ) : null,
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Formation pitch
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_CLASSES = {
  blue: {
    borderB: "border-blue-500/20",
    border: "border-blue-500/30",
    text: "text-blue-300",
    bgBadge: "bg-blue-600/40",
    bgChip: "bg-blue-600/20",
    chipBorder: "border-blue-500/30",
  },
  rose: {
    borderB: "border-rose-500/20",
    border: "border-rose-500/30",
    text: "text-rose-300",
    bgBadge: "bg-rose-600/40",
    bgChip: "bg-rose-600/20",
    chipBorder: "border-rose-500/30",
  },
} as const;

function FormationPitch({
  side,
  color,
}: {
  side: MatchSide;
  color: "blue" | "rose";
}) {
  const c = COLOR_CLASSES[color];
  const fill = color === "blue" ? "#3b82f6" : "#f43f5e";
  const stroke = color === "blue" ? "#60a5fa" : "#fb7185";

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
      <div className={`flex items-center justify-between pb-3 border-b ${c.borderB}`}>
        <h5 className={`${c.text} font-bold text-base`}>{side.team.name}</h5>
        <span className={`text-white text-sm font-bold ${c.bgBadge} px-3 py-1.5 rounded-lg`}>
          {side.formation}
        </span>
      </div>

      <svg
        viewBox="0 0 100 100"
        className={`w-full bg-gradient-to-b from-[#0f4a3a] to-[#071e38] rounded-xl border ${c.border} aspect-square shadow-lg`}
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
            className={`${c.bgChip} border ${c.chipBorder} rounded-lg px-3 py-2 text-xs`}
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
}: {
  events: MatchEvent[];
  homeTeamId: number;
  homeName: string;
  awayName: string;
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
        {/* Home (blue) markers above bar — label on the left */}
        <div className="flex items-end gap-1">
          <span className={`${LABEL_W} flex-shrink-0 text-[10px] font-bold text-blue-400 tracking-wider text-right pb-0.5`}>
            {homeCode}
          </span>
          <div className="relative h-10 flex-1 mb-0.5">
            {homeEvents.map((e, i) => (
              <div
                key={i}
                style={{ left: `${pct(e.minute, e.extra)}%` }}
                className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center"
              >
                <span className="text-[10px] text-blue-300/90 font-bold tabular-nums leading-none mb-0.5">
                  {e.minute}{e.extra ? `+${e.extra}` : ""}'
                </span>
                <span className="text-sm leading-none">{getEventConfig(e.type).icon}</span>
                <div className="w-px h-2 bg-blue-400/30 mt-0.5" />
              </div>
            ))}
          </div>
        </div>

        {/* The bar — padded left to align with marker area */}
        <div className="flex items-center gap-1">
          <div className={`${LABEL_W} flex-shrink-0`} />
          <div className="relative h-2.5 rounded-full bg-[#0f2d4a] border border-[#1a4a7a] overflow-visible flex-1">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-600/20 via-transparent to-rose-600/20" />
            <div
              style={{ left: `${(45 / maxMinute) * 100}%` }}
              className="absolute top-0 bottom-0 w-px bg-white/15"
            />
            {events.map((e, i) => {
              const isHome = e.teamId === homeTeamId;
              return (
                <div
                  key={i}
                  style={{ left: `${pct(e.minute, e.extra)}%` }}
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 z-10 ${
                    isHome ? "bg-blue-400 border-blue-200" : "bg-rose-400 border-rose-200"
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Away (rose) markers below bar — label on the left */}
        <div className="flex items-start gap-1">
          <span className={`${LABEL_W} flex-shrink-0 text-[10px] font-bold text-rose-400 tracking-wider text-right pt-0.5`}>
            {awayCode}
          </span>
          <div className="relative h-10 flex-1 mt-0.5">
            {awayEvents.map((e, i) => (
              <div
                key={i}
                style={{ left: `${pct(e.minute, e.extra)}%` }}
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
              >
                <div className="w-px h-2 bg-rose-400/30 mb-0.5" />
                <span className="text-sm leading-none">{getEventConfig(e.type).icon}</span>
                <span className="text-[10px] text-rose-300/90 font-bold tabular-nums leading-none mt-0.5">
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
          <span className="text-blue-400/70 text-right truncate">{homeName}</span>
          <span className="text-center">Min</span>
          <span className="text-rose-400/70 truncate">{awayName}</span>
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
            className="sticky top-3 float-right mr-3 z-10 w-9 h-9 inline-flex items-center justify-center rounded-full bg-[#071e38]/90 border border-[#1a4a7a] text-gray-300 hover:text-white hover:border-white/30 transition-colors"
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
              <div className="text-5xl font-bold text-blue-400">{home.stats.goals}</div>
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
              <div className="text-5xl font-bold text-rose-400">{away.stats.goals}</div>
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
          />
        </motion.div>

        {/* Team comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#071e38]/80 border border-[#1a4a7a] rounded-2xl p-6 mb-8"
        >
          <h3 className="text-white text-xl font-bold mb-6">Team Comparison</h3>
          <div className="space-y-4">
            <ProgressBar
              label="Possession"
              homeValue={home.stats.possession}
              awayValue={away.stats.possession}
              unit="%"
            />
            <ProgressBar label="Shots" homeValue={home.stats.shots} awayValue={away.stats.shots} />
            <ProgressBar
              label="Shots on Target"
              homeValue={home.stats.shotsOnTarget}
              awayValue={away.stats.shotsOnTarget}
            />
            <ProgressBar
              label="Total Passes"
              homeValue={home.stats.totalPasses}
              awayValue={away.stats.totalPasses}
            />
            <ProgressBar
              label="Pass Accuracy"
              homeValue={home.stats.passAccuracy}
              awayValue={away.stats.passAccuracy}
              unit="%"
            />
            <ProgressBar label="Key Passes" homeValue={home.stats.keyPasses} awayValue={away.stats.keyPasses} />
            <ProgressBar label="Tackles" homeValue={tackles.home} awayValue={tackles.away} />
            <ProgressBar label="Interceptions" homeValue={intercepts.home} awayValue={intercepts.away} />
            <ProgressBar label="Dribbles Completed" homeValue={dribbles.home} awayValue={dribbles.away} />
            <ProgressBar label="Duels Won" homeValue={duelsWon.home} awayValue={duelsWon.away} />
            <ProgressBar label="Fouls" homeValue={home.stats.fouls} awayValue={away.stats.fouls} />
            <ProgressBar label="Corners" homeValue={home.stats.corners} awayValue={away.stats.corners} />
          </div>
        </motion.div>

        {/* Player ratings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#071e38]/80 border border-[#1a4a7a] rounded-2xl p-6 mb-8"
        >
          <h3 className="text-white text-xl font-bold mb-6">Player Performance Ratings</h3>
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h4 className="text-blue-300 text-sm font-bold mb-4">{home.team.name}</h4>
              <PlayersByPosition players={home.players} teamColor="blue" />
            </div>
            <div>
              <h4 className="text-rose-300 text-sm font-bold mb-4">{away.team.name}</h4>
              <PlayersByPosition players={away.players} teamColor="rose" />
            </div>
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
            <FormationPitch side={home} color="blue" />
            <FormationPitch side={away} color="rose" />
          </div>
        </motion.div>
      </div>
    </div>,
  );
}
