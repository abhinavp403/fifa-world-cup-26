"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { X, ChevronUp, ChevronDown, ArrowLeft } from "lucide-react";

import { GROUPS, TEAM_COLORS } from "@/lib/worldcup";
import { ZERO_STATS, type SquadPlayer, type PlayerStats } from "@/lib/squads";
import { useSquads } from "@/lib/squadsContext";
import Flag from "@/components/Flag";

// ─────────────────────────────────────────────────────────────────────────────
// Stat column definitions per position
// ─────────────────────────────────────────────────────────────────────────────

type StatDef = { key: keyof PlayerStats; label: string; title: string; fmt?: "rating" | "cards"; key2?: keyof PlayerStats };
type SortDir = "asc" | "desc";

const POS_STAT_DEFS: Record<string, StatDef[]> = {
  GK: [
    { key: "appearances",   label: "AP",  title: "Appearances"    },
    { key: "minutesPlayed", label: "MIN", title: "Minutes Played" },
    { key: "saves",         label: "SV",  title: "Saves"          },
    { key: "cleanSheets",   label: "CS",  title: "Clean Sheets"   },
    { key: "goalsConceded", label: "GC",  title: "Goals Conceded" },
    { key: "yellowCards", key2: "redCards", label: "YC/RC", title: "Cards (Yellow / Red)", fmt: "cards" },
    { key: "rating",        label: "RTG", title: "Avg Rating", fmt: "rating" },
  ],
  DEF: [
    { key: "appearances",   label: "AP",  title: "Appearances"    },
    { key: "minutesPlayed", label: "MIN", title: "Minutes Played" },
    { key: "goals",         label: "G",   title: "Goals"          },
    { key: "assists",       label: "A",   title: "Assists"        },
    { key: "keyPasses",     label: "KP",  title: "Key Passes"     },
    { key: "tackles",       label: "TKL", title: "Tackles"        },
    { key: "interceptions", label: "INT", title: "Interceptions"  },
    { key: "duelsWon",      label: "DW",  title: "Duels Won"      },
    { key: "yellowCards", key2: "redCards", label: "YC/RC", title: "Cards (Yellow / Red)", fmt: "cards" },
    { key: "rating",        label: "RTG", title: "Avg Rating", fmt: "rating" },
  ],
  MID: [
    { key: "appearances",   label: "AP",  title: "Appearances"    },
    { key: "minutesPlayed", label: "MIN", title: "Minutes Played" },
    { key: "goals",         label: "G",   title: "Goals"          },
    { key: "assists",       label: "A",   title: "Assists"        },
    { key: "shots",         label: "SH",  title: "Shots"          },
    { key: "keyPasses",     label: "KP",  title: "Key Passes"     },
    { key: "dribbles",      label: "DRB", title: "Dribbles"       },
    { key: "interceptions", label: "INT", title: "Interceptions"  },
    { key: "yellowCards", key2: "redCards", label: "YC/RC", title: "Cards (Yellow / Red)", fmt: "cards" },
    { key: "rating",        label: "RTG", title: "Avg Rating", fmt: "rating" },
  ],
  FWD: [
    { key: "appearances",   label: "AP",  title: "Appearances"    },
    { key: "minutesPlayed", label: "MIN", title: "Minutes Played" },
    { key: "goals",         label: "G",   title: "Goals"          },
    { key: "assists",       label: "A",   title: "Assists"        },
    { key: "shots",         label: "SH",  title: "Shots"          },
    { key: "shotsOnTarget", label: "SOT", title: "Shots on Target"},
    { key: "keyPasses",     label: "KP",  title: "Key Passes"     },
    { key: "dribbles",      label: "DRB", title: "Dribbles"       },
    { key: "yellowCards", key2: "redCards", label: "YC/RC", title: "Cards (Yellow / Red)", fmt: "cards" },
    { key: "rating",        label: "RTG", title: "Avg Rating", fmt: "rating" },
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
  // photo | name | n stat columns — narrow as columns grow
  const w = n <= 6 ? 4.2 : n <= 9 ? 3.8 : 3.5;
  return `5.5rem 1fr ${Array(n).fill(`${w}rem`).join(" ")}`;
}

function ratingBadge(val: number) {
  if (val === 0) return { text: "—",              cls: "bg-gray-700/40 text-gray-600" };
  if (val >= 8.0) return { text: val.toFixed(1),  cls: "bg-emerald-500 text-white"   };
  if (val >= 7.0) return { text: val.toFixed(1),  cls: "bg-lime-600 text-white"      };
  if (val >= 6.5) return { text: val.toFixed(1),  cls: "bg-amber-500 text-white"     };
  if (val >= 6.0) return { text: val.toFixed(1),  cls: "bg-orange-500 text-white"    };
  return            { text: val.toFixed(1),        cls: "bg-rose-600 text-white"      };
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
  onClick,
}: {
  player:    SquadPlayer;
  statDefs:  StatDef[];
  sortKey:   keyof PlayerStats;
  teamColor: string;
  onClick:   () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="grid items-center gap-x-4 px-4 py-4 border-b border-[var(--border-row)]/60 last:border-0 hover:bg-white/[0.04] cursor-pointer transition-colors"
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
      {statDefs.map(({ key, key2, fmt }) => {
        const val = getStat(player, key);
        const isActive = key === sortKey;

        if (fmt === "rating") {
          const { text, cls } = ratingBadge(val);
          return (
            <div key={key} className="flex justify-center">
              <span className={`text-[11px] font-bold px-2 py-1 rounded-lg tabular-nums ${cls}`}>
                {text}
              </span>
            </div>
          );
        }

        if (fmt === "cards") {
          const yc = val;
          const rc = key2 ? getStat(player, key2) : 0;
          const hasCards = yc > 0 || rc > 0;
          return (
            <p key={key} className="text-center tabular-nums text-sm leading-none">
              <span className={yc > 0 ? "text-amber-400 font-bold" : "text-gray-700"}>{yc}</span>
              <span className="text-gray-600 mx-0.5">/</span>
              <span className={rc > 0 ? "text-rose-500 font-bold" : "text-gray-700"}>{rc}</span>
            </p>
          );
        }

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
  onPlayerClick,
}: {
  pos:           string;
  players:       SquadPlayer[];
  teamColor:     string;
  onPlayerClick: (p: SquadPlayer) => void;
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
    <div className="mb-3 rounded-xl overflow-hidden border border-[var(--border-card)]">
      {/* Header */}
      <div
        className="grid items-center gap-x-4 px-4 py-2.5 bg-[var(--bg-card-deep)]"
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
      <div className="bg-[var(--bg-card)]/60">
        {sorted.map((p) => (
          <PlayerRow
            key={p.number}
            player={p}
            statDefs={statDefs}
            sortKey={sort.col}
            teamColor={teamColor}
            onClick={() => onPlayerClick(p)}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Player detail view
// ─────────────────────────────────────────────────────────────────────────────

function StatBlock({
  label,
  value,
  sub,
  accent,
}: {
  label:   string;
  value:   string | number;
  sub?:    string;
  accent?: string;
}) {
  return (
    <div className="bg-[var(--bg-card-deep)] border border-[var(--border-row)] rounded-xl p-3 text-center">
      <p className="text-[9px] font-bold tracking-widest text-gray-600 uppercase mb-1.5 leading-tight">
        {label}
      </p>
      <p
        className="text-2xl font-black tabular-nums leading-none"
        style={{ color: accent ?? "#e2e8f0" }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-gray-600 text-[9px] mt-1.5 leading-tight">{sub}</p>
      )}
    </div>
  );
}

function StatSection({
  title,
  color,
  children,
}: {
  title:    string;
  color:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <p className="text-[10px] font-black tracking-widest uppercase" style={{ color }}>
          {title}
        </p>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2">
        {children}
      </div>
    </div>
  );
}

function PlayerDetailView({
  player,
  teamColor,
  onBack,
  hideBack = false,
}: {
  player:    SquadPlayer;
  teamColor: string;
  onBack:    () => void;
  hideBack?: boolean;
}) {
  const s   = player.stats ?? ZERO_STATS;
  const pos = player.position;
  const subApps       = Math.max(0, s.appearances - s.started);
  const shootingAcc   = s.shots > 0
    ? Math.round((s.shotsOnTarget / s.shots) * 100) : null;
  const saveAcc       = (s.saves + s.goalsConceded) > 0
    ? Math.round((s.saves / (s.saves + s.goalsConceded)) * 100) : null;
  const dribbleSucc   = s.dribbleAttempts > 0
    ? Math.round((s.dribbles / s.dribbleAttempts) * 100) : null;
  const duelWinPct    = s.duelsTotal > 0
    ? Math.round((s.duelsWon / s.duelsTotal) * 100) : null;
  const penConversion = (s.penaltyScored + s.penaltyMissed) > 0
    ? Math.round((s.penaltyScored / (s.penaltyScored + s.penaltyMissed)) * 100) : null;
  const { text: rtgText, cls: rtgCls } = ratingBadge(s.rating);

  return (
    <div className="px-4 sm:px-8 py-6">

      {/* ── Navigation bar ── */}
      {!hideBack && (
        <div className="mb-7">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-semibold group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            Back to squad
          </button>
        </div>
      )}

      {/* ── Player hero ── */}
      <div
        className="flex items-start gap-5 mb-8 pb-7 border-b"
        style={{ borderBottomColor: teamColor + "33" }}
      >
        <div className="relative flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24">
          {player.photo ? (
            <Image
              src={player.photo}
              alt={player.name}
              fill
              sizes="96px"
              className="object-cover object-top rounded-2xl"
              style={{ backgroundColor: teamColor + "22" }}
              unoptimized
            />
          ) : (
            <div
              className="w-full h-full rounded-2xl flex items-center justify-center text-2xl font-black text-white"
              style={{ backgroundColor: teamColor + "55", border: `2px solid ${teamColor}44` }}
            >
              {player.number}
            </div>
          )}
          <span
            className="absolute -bottom-1 -right-1 text-[11px] font-black w-6 h-6 flex items-center justify-center rounded-full leading-none shadow-lg"
            style={{ backgroundColor: teamColor, color: "#020d1c" }}
          >
            {player.number}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              {player.name}
            </h2>
            {player.captain && (
              <span
                className="text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider mt-1.5 flex-shrink-0"
                style={{ color: teamColor, backgroundColor: teamColor + "22", border: `1px solid ${teamColor}44` }}
              >
                CAPTAIN
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap text-sm">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded"
              style={{ color: teamColor, backgroundColor: teamColor + "22" }}
            >
              {pos}
            </span>
            <span className="text-gray-400">
              Age <span className="text-gray-200 font-semibold">{player.age}</span>
            </span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-400">
              <span className="text-gray-200 font-semibold">{player.club}</span>
            </span>
          </div>
          <div className="mt-3">
            <span className={`text-sm font-bold px-3 py-1 rounded-lg ${rtgCls}`}>
              {s.rating > 0 ? `${rtgText} avg rating` : "No rating yet"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Overview ── */}
      <StatSection title="Overview" color={teamColor}>
        <StatBlock
          label="Appearances"
          value={s.appearances}
          sub={`${s.started} started · ${subApps} sub`}
        />
        <StatBlock label="Minutes" value={s.minutesPlayed} sub="played" />
      </StatSection>

      {/* ── Goalkeeping ── */}
      {pos === "GK" && (
        <StatSection title="Goalkeeping" color={teamColor}>
          <StatBlock label="Saves"           value={s.saves}         />
          <StatBlock label="Clean Sheets"    value={s.cleanSheets}   />
          <StatBlock label="Goals Conceded"  value={s.goalsConceded} />
          <StatBlock label="Penalties Saved" value={s.penaltySaved}  />
          <StatBlock label="Save %"          value={saveAcc !== null ? `${saveAcc}%` : "—"} />
        </StatSection>
      )}

      {/* ── Defensive ── */}
      {(pos === "DEF" || pos === "MID") && (
        <StatSection title="Defensive" color={teamColor}>
          <StatBlock label="Tackles"       value={s.tackles}       />
          <StatBlock label="Interceptions" value={s.interceptions} />
          <StatBlock label="Duels Won"     value={s.duelsWon}      />
          <StatBlock label="Duels Total"   value={s.duelsTotal}    />
          <StatBlock label="Duel Win %"    value={duelWinPct !== null ? `${duelWinPct}%` : "—"} />
          <StatBlock label="Dribbles"      value={s.dribbles}      />
          <StatBlock label="Drb Attempts"  value={s.dribbleAttempts} />
          <StatBlock label="Dribble Succ %" value={dribbleSucc !== null ? `${dribbleSucc}%` : "—"} />
        </StatSection>
      )}

      {/* ── Dribbling & Duels (FWD) ── */}
      {pos === "FWD" && (
        <StatSection title="Dribbling & Duels" color={teamColor}>
          <StatBlock label="Dribbles"       value={s.dribbles}      />
          <StatBlock label="Drb Attempts"   value={s.dribbleAttempts} />
          <StatBlock label="Dribble Succ %" value={dribbleSucc !== null ? `${dribbleSucc}%` : "—"} />
          <StatBlock label="Duels Won"      value={s.duelsWon}      />
          <StatBlock label="Duels Total"    value={s.duelsTotal}    />
          <StatBlock label="Duel Win %"     value={duelWinPct !== null ? `${duelWinPct}%` : "—"} />
        </StatSection>
      )}

      {/* ── Passing (outfield) ── */}
      {pos !== "GK" && (
        <StatSection title="Passing" color={teamColor}>
          <StatBlock label="Total Passes" value={s.passes} />
          <StatBlock
            label="Pass Acc %"
            value={s.passAccuracy > 0 ? `${s.passAccuracy}%` : "—"}
          />
        </StatSection>
      )}

      {/* ── Attacking (outfield) ── */}
      {pos !== "GK" && (
        <StatSection title="Attacking" color={teamColor}>
          <StatBlock label="Goals"   value={s.goals}   accent={s.goals > 0 ? "#4ade80" : undefined} />
          <StatBlock label="Assists" value={s.assists} accent={s.assists > 0 ? "#60a5fa" : undefined} />
          <StatBlock label="Shots"          value={s.shots}         />
          <StatBlock label="On Target"      value={s.shotsOnTarget} />
          <StatBlock label="Shooting Acc %" value={shootingAcc !== null ? `${shootingAcc}%` : "—"} />
          <StatBlock label="Key Passes"     value={s.keyPasses}     />
          {(pos === "MID" || pos === "FWD") && (
            <StatBlock label="Offsides" value={s.offsides} />
          )}
        </StatSection>
      )}

      {/* ── Penalties (MID + FWD) ── */}
      {(pos === "MID" || pos === "FWD") && (
        <StatSection title="Penalties" color={teamColor}>
          <StatBlock label="Scored"       value={s.penaltyScored}  accent={s.penaltyScored > 0 ? "#4ade80" : undefined} />
          <StatBlock label="Missed"       value={s.penaltyMissed}  accent={s.penaltyMissed > 0 ? "#f43f5e" : undefined} />
          <StatBlock label="Won"          value={s.penaltyWon}     />
          <StatBlock label="Conversion %" value={penConversion !== null ? `${penConversion}%` : "—"} />
        </StatSection>
      )}

      {/* ── Discipline (all) ── */}
      <StatSection title="Discipline" color={teamColor}>
        <StatBlock label="Fouls Committed" value={s.foulsCommitted} accent={s.foulsCommitted > 0 ? "#fb923c" : undefined} />
        <StatBlock label="Fouls Drawn"     value={s.foulsDrawn}     />
        <StatBlock label="Yellow Cards"    value={s.yellowCards}    accent={s.yellowCards > 0 ? "#fbbf24" : undefined} />
        <StatBlock label="Red Cards"       value={s.redCards}       accent={s.redCards > 0 ? "#f43f5e" : undefined} />
      </StatSection>

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
    <div className="bg-[var(--bg-card)]/80 border border-[var(--border-strong)] rounded-xl p-4 text-center">
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
  initialPlayerNumber,
  onClose,
}: {
  teamCode:             string | null;
  initialPlayerNumber?: number | null;
  onClose:              () => void;
}) {
  const squads = useSquads();
  const [selectedPlayer, setSelectedPlayer] = useState<SquadPlayer | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reset player selection when a different team is opened, or auto-select
  // a specific player when one is requested (e.g. from the global search).
  useEffect(() => {
    if (teamCode && initialPlayerNumber != null) {
      const squad = squads[teamCode];
      const match = squad?.players.find((p) => p.number === initialPlayerNumber);
      setSelectedPlayer(match ?? null);
    } else {
      setSelectedPlayer(null);
    }
  }, [teamCode, initialPlayerNumber, squads]);

  // Scroll modal to top whenever the view changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [selectedPlayer]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // If we entered directly into a player (no squad list to fall back to),
        // close the whole modal in one step.
        if (selectedPlayer && initialPlayerNumber == null) {
          setSelectedPlayer(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, selectedPlayer, initialPlayerNumber]);

  const squad = teamCode ? squads[teamCode]                            : null;
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
        ref={scrollContainerRef}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative bg-[var(--bg-darker)] border border-[var(--border-strong)] sm:rounded-2xl w-full sm:max-w-[80vw] max-h-screen sm:max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div
          className="h-1 w-full rounded-t-2xl flex-shrink-0"
          style={{ background: `linear-gradient(to right, ${color}, ${color}44, transparent)` }}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sticky top-3 float-right mr-7 z-10 w-9 h-9 inline-flex items-center justify-center rounded-full bg-[var(--bg-card)]/90 border border-[var(--border-strong)] text-gray-300 hover:text-white hover:border-white/30 transition-colors"
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

  if (selectedPlayer) {
    return shell(
      <PlayerDetailView
        player={selectedPlayer}
        teamColor={color}
        onBack={() => setSelectedPlayer(null)}
        hideBack={initialPlayerNumber != null}
      />,
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
        <Flag code={team.code} size="lg" className="w-20 h-14 sm:w-24 sm:h-16 drop-shadow-lg" />
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
          onPlayerClick={setSelectedPlayer}
        />
      ))}

      {/* ── Legend ── */}
      <div className="mt-6 pb-2 border-t border-[var(--border-card)] pt-4">
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
            { label: "DW",  title: "Duels Won"       },
            { label: "KP",  title: "Key Passes"      },
            { label: "DRB", title: "Dribbles"        },
            { label: "SH",  title: "Shots"           },
            { label: "SOT", title: "Shots on Target" },
            { label: "OFF",   title: "Offsides"              },
            { label: "YC/RC", title: "Cards (Yellow / Red)"  },
            { label: "RTG",   title: "Avg Match Rating"      },
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
