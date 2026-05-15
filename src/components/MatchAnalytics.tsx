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

function KeyMomentsTimeline({
  events,
  homeTeamId,
}: {
  events: MatchEvent[];
  homeTeamId: number;
}) {
  const typeIcons: Record<string, string> = {
    goal: "⚽",
    substitution: "🔄",
    yellowCard: "🟨",
    redCard: "🟥",
  };

  const typeLabels: Record<string, string> = {
    goal: "Goal",
    substitution: "Substitution",
    yellowCard: "Yellow Card",
    redCard: "Red Card",
  };

  if (events.length === 0) {
    return (
      <div className="text-gray-400 text-sm">No events recorded for this fixture.</div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-white text-xl font-bold">Key Moments & Turning Points</h3>

      <div className="relative py-4">
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500/30 via-gray-600/30 to-rose-500/30 transform -translate-x-1/2" />

        <div className="space-y-6">
          {events.map((e, i) => {
            const isHome = e.teamId === homeTeamId;
            const isLeftSide = i % 2 === 0;
            const bgColor = isHome
              ? "bg-blue-500/10 border-blue-500/30"
              : "bg-rose-500/10 border-rose-500/30";
            const badgeColor = isHome ? "bg-blue-600/70" : "bg-rose-600/70";
            const textColor = isHome ? "text-blue-300" : "text-rose-300";

            return (
              <motion.div
                key={`${e.minute}-${i}`}
                initial={{ opacity: 0, x: isLeftSide ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-4 ${isLeftSide ? "flex-row" : "flex-row-reverse"}`}
              >
                <div className={`w-5/12 ${bgColor} border rounded-lg p-3.5 hover:border-opacity-100 transition-all`}>
                  <div className="flex items-start gap-2.5">
                    <div className={`${badgeColor} rounded-full w-9 h-9 flex items-center justify-center flex-shrink-0 font-bold text-sm text-white shadow-md`}>
                      {typeIcons[e.type] ?? "•"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm leading-tight">
                        {e.player}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        {typeLabels[e.type] ?? e.detail}
                        {e.assist && e.type === "goal" && (
                          <span className="text-gray-500"> · assist {e.assist}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="w-2/12 flex justify-center">
                  <div className="w-3 h-3 rounded-full bg-gray-600 border-2 border-[#071e38] shadow-md" />
                </div>

                <div className={`w-5/12 ${isLeftSide ? "text-right" : "text-left"}`}>
                  <span className={`${textColor} font-bold text-sm px-3 py-1.5 bg-white/5 rounded-lg inline-block`}>
                    {e.minute}
                    {e.extra ? `+${e.extra}` : ""}'
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
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
          <KeyMomentsTimeline events={events} homeTeamId={home.team.id} />
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
