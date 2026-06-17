"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ArrowLeftRight, Trophy, BarChart3 } from "lucide-react";

import { GROUPS, TEAM_COLORS, type Team } from "@/lib/worldcup";
import type { Squad } from "@/lib/squads";
import { useSquads } from "@/lib/squadsContext";
import type { Round, Match } from "@/lib/bracket";
import type { ResolvedGroup } from "@/lib/resolver";
import type { TeamFixtureAggregate } from "@/lib/teamFixtureStats";
import TeamStatsModal from "@/components/TeamStatsModal";
import Flag from "@/components/Flag";
import { normalizeText } from "@/lib/text";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TeamComparisonPayload = {
  groups:    ResolvedGroup[];
  bracket:   Round[];
  champion:  Team | null;
  teamFixtureStats?: Record<string, TeamFixtureAggregate>;
} | null;

export type TeamStats = {
  played:        number;
  wins:          number;
  draws:         number;
  losses:        number;
  goalsScored:   number;
  goalsConceded: number;
  cleanSheets:   number;
  stage:         string;
  topScorer:     { name: string; goals: number } | null;
  // Aggregated from individual player stats (sums across the squad)
  shots:         number;
  shotsOnTarget: number;
  fouls:         number;
  yellowCards:   number;
  redCards:      number;
  keyPasses:     number;
  tackles:       number;
  interceptions: number;
  saves:         number;
  dribbles:      number; // summed from per-player completed dribbles
  // Passing — totals from player stats. Pass accuracy is derived as
  // passesAccurate / passes * 100 by the consumer.
  passes:        number;
  passesAccurate: number;
  // Team-level fixture stats — not yet wired up. Need
  // /fixtures/statistics aggregation across each team's tournament
  // matches (api-football); 0 until that pipeline exists.
  possession:    number; // average possession % (0–100)
  corners:       number; // total corners taken
  // Team-level fixture stats from the sportapi7 statistics endpoint.
  xg:              number; // expected goals (sum)
  clearances:      number;
  crosses:         number;
  freeKicks:       number;
  shotsInsideBox:  number;
  shotsOutsideBox: number;
  touchesInBox:    number; // touches in the opposition box
  tacklesWonPct:   number; // 0–100 (averaged across matches)
  duelsPct:        number; // 0–100 (averaged)
  dribblesPct:     number; // 0–100 (averaged)
  // Rolled up from per-player stats (the sync collects these per player).
  longBalls:       number;
  ballRecoveries:  number;
};

const ALL_TEAMS = GROUPS.flatMap((g) => g.teams);

// ─────────────────────────────────────────────────────────────────────────────
// Stats computation
// ─────────────────────────────────────────────────────────────────────────────

function applyResult(stats: TeamStats, teamGoals: number, oppGoals: number) {
  stats.played++;
  stats.goalsScored   += teamGoals;
  stats.goalsConceded += oppGoals;
  if (oppGoals === 0) stats.cleanSheets++;
  if (teamGoals > oppGoals)      stats.wins++;
  else if (teamGoals === oppGoals) stats.draws++;
  else                            stats.losses++;
}

function deepestBracketRound(teamCode: string, bracket: Round[]): string | null {
  let deepest: string | null = null;
  for (const round of bracket) {
    const present = round.matches.some(
      (m) => m.slot1.team?.code === teamCode || m.slot2.team?.code === teamCode,
    );
    if (present) deepest = round.short;
  }
  return deepest;
}

function stageLabel(short: string | null): string {
  switch (short) {
    case "FINAL": return "Runner-up";
    case "SF":    return "Semi-finals";
    case "QF":    return "Quarter-finals";
    case "R16":   return "Round of 16";
    case "R32":   return "Round of 32";
    default:      return "";
  }
}

export function computeTeamStats(
  teamCode: string,
  payload:  TeamComparisonPayload,
  squads:   Record<string, Squad>,
): TeamStats {
  const stats: TeamStats = {
    played: 0, wins: 0, draws: 0, losses: 0,
    goalsScored: 0, goalsConceded: 0, cleanSheets: 0,
    stage: "Yet to play", topScorer: null,
    shots: 0, shotsOnTarget: 0, fouls: 0,
    yellowCards: 0, redCards: 0, keyPasses: 0,
    tackles: 0, interceptions: 0, saves: 0, dribbles: 0,
    passes: 0, passesAccurate: 0,
    possession: 0, corners: 0,
    xg: 0, clearances: 0, crosses: 0, freeKicks: 0,
    shotsInsideBox: 0, shotsOutsideBox: 0, touchesInBox: 0,
    tacklesWonPct: 0, duelsPct: 0, dribblesPct: 0,
    longBalls: 0, ballRecoveries: 0,
  };

  if (payload) {
    // ── Group matches ──
    for (const group of payload.groups) {
      for (const match of group.matches ?? []) {
        if (match.status !== "FINISHED") continue;
        const isHome = match.homeCode === teamCode;
        const isAway = match.awayCode === teamCode;
        if (!isHome && !isAway) continue;
        const teamGoals = isHome ? match.homeScore : match.awayScore;
        const oppGoals  = isHome ? match.awayScore : match.homeScore;
        if (teamGoals == null || oppGoals == null) continue;
        applyResult(stats, teamGoals, oppGoals);
      }
    }

    // ── Bracket matches ──
    for (const round of payload.bracket) {
      for (const match of round.matches as Match[]) {
        if (match.status !== "FINISHED") continue;
        const isHome = match.slot1.team?.code === teamCode;
        const isAway = match.slot2.team?.code === teamCode;
        if (!isHome && !isAway) continue;
        const teamGoals = isHome ? match.homeScore : match.awayScore;
        const oppGoals  = isHome ? match.awayScore : match.homeScore;
        if (teamGoals == null || oppGoals == null) continue;
        applyResult(stats, teamGoals, oppGoals);
      }
    }

    // ── Stage ──
    if (payload.champion?.code === teamCode) {
      stats.stage = "Champions";
    } else {
      const deepest = deepestBracketRound(teamCode, payload.bracket);
      const label = stageLabel(deepest);
      stats.stage = label || (stats.played > 0 ? "Group Stage" : "Yet to play");
    }
  }

  // ── Squad-level aggregates (top scorer + team totals from player stats) ──
  const squad = squads[teamCode];
  if (squad) {
    for (const player of squad.players) {
      const s = player.stats;
      const goals = s?.goals ?? 0;
      if (!stats.topScorer || goals > stats.topScorer.goals) {
        stats.topScorer = { name: player.name, goals };
      }
      if (!s) continue;
      stats.shots          += s.shots;
      stats.shotsOnTarget  += s.shotsOnTarget;
      stats.fouls          += s.foulsCommitted;
      stats.yellowCards    += s.yellowCards;
      stats.redCards       += s.redCards;
      stats.keyPasses      += s.keyPasses;
      stats.tackles        += s.tackles;
      stats.interceptions  += s.interceptions;
      stats.dribbles       += s.dribbles;
      stats.saves          += s.saves;
      stats.passes         += s.passes;
      stats.longBalls      += s.longBalls;
      stats.ballRecoveries += s.ballRecoveries;
      // passAccuracy stored per-player as 0–100; derive accurate-pass
      // count to allow proper team-level weighted accuracy.
      stats.passesAccurate += Math.round((s.passes * s.passAccuracy) / 100);
    }
    if (stats.topScorer && stats.topScorer.goals === 0) {
      // No goals yet — leave the slot empty rather than picking arbitrary player.
      stats.topScorer = null;
    }
  }

  // ── Team aggregates from api-football per-fixture pipeline ──
  // The aggregated values are the source of truth — they're computed
  // from each finished fixture's actual statistics + player rollups.
  // We only overwrite when the aggregator returned data for this team
  // (i.e. matches > 0); otherwise we keep the zeroed squad-stat fallback.
  const fxAgg = payload?.teamFixtureStats?.[teamCode];
  if (fxAgg && fxAgg.matches > 0) {
    stats.possession     = fxAgg.possession;
    stats.corners        = fxAgg.corners;
    stats.shots          = fxAgg.shots;
    stats.shotsOnTarget  = fxAgg.shotsOnTarget;
    stats.fouls          = fxAgg.fouls;
    stats.yellowCards    = fxAgg.yellowCards;
    stats.redCards       = fxAgg.redCards;
    stats.saves          = fxAgg.saves;
    stats.passes         = fxAgg.passes;
    stats.passesAccurate = fxAgg.passesAccurate;
    stats.keyPasses      = fxAgg.keyPasses;
    stats.tackles        = fxAgg.tackles;
    stats.interceptions  = fxAgg.interceptions;
    stats.xg             = fxAgg.xg;
    stats.clearances     = fxAgg.clearances;
    stats.crosses        = fxAgg.crosses;
    stats.freeKicks      = fxAgg.freeKicks;
    stats.shotsInsideBox = fxAgg.shotsInsideBox;
    stats.shotsOutsideBox = fxAgg.shotsOutsideBox;
    stats.touchesInBox   = fxAgg.touchesInBox;
    stats.tacklesWonPct  = fxAgg.tacklesWonPct;
    stats.duelsPct       = fxAgg.duelsPct;
    stats.dribblesPct    = fxAgg.dribblesPct;
  }

  return stats;
}

// ─────────────────────────────────────────────────────────────────────────────
// TeamPicker — custom dropdown so flag emojis render reliably
// ─────────────────────────────────────────────────────────────────────────────

function TeamPicker({
  value,
  onChange,
  excluded,
  placeholder,
}: {
  value:       string | null;
  onChange:    (code: string | null) => void;
  excluded:    string | null;
  placeholder: string;
}) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selected = value ? ALL_TEAMS.find((t) => t.code === value) : null;

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim());
    return [...ALL_TEAMS]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((t) => !q || normalizeText(t.name).includes(q) || normalizeText(t.code).includes(q));
  }, [query]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 bg-[var(--bg-darker)] border rounded-xl px-3 py-2.5 text-sm transition-colors ${
          open
            ? "border-[var(--accent-500)]/60"
            : "border-[var(--border-card)] hover:border-[var(--border-strong)]"
        }`}
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <Flag code={selected.code} size="md" />
            <span className="text-white font-semibold truncate">{selected.name}</span>
          </span>
        ) : (
          <span className="text-gray-600">{placeholder}</span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 left-0 right-0 bg-[var(--bg-darker)] border border-[var(--border-card)] rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-[var(--border-card)]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teams…"
              autoFocus
              className="w-full bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[var(--accent-500)]/50"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-gray-600 text-xs italic px-3 py-4 text-center">
                No teams match.
              </p>
            ) : (
              filtered.map((t) => {
                const isExcluded = t.code === excluded;
                const isSelected = t.code === value;
                return (
                  <button
                    key={t.code}
                    type="button"
                    disabled={isExcluded}
                    onClick={() => {
                      onChange(t.code);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                      isExcluded
                        ? "opacity-30 cursor-not-allowed"
                        : isSelected
                        ? "bg-[var(--accent-500)]/15 text-white"
                        : "text-gray-300 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <Flag code={t.code} size="sm" />
                    <span className="truncate flex-1">{t.name}</span>
                    <span className="text-[10px] text-gray-600 font-bold tracking-wider">
                      {t.code}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat row
// ─────────────────────────────────────────────────────────────────────────────

function StatRow({
  label,
  valA,
  valB,
  highlightHigher = true,
}: {
  label:            string;
  valA:             string | number;
  valB:             string | number;
  highlightHigher?: boolean;
}) {
  const numA = typeof valA === "number" ? valA : null;
  const numB = typeof valB === "number" ? valB : null;
  const aWins =
    highlightHigher && numA != null && numB != null && numA > numB;
  const bWins =
    highlightHigher && numA != null && numB != null && numB > numA;

  const cellCls = (winning: boolean) =>
    winning
      ? "text-white font-black"
      : "text-gray-300 font-semibold";

  return (
    <div className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-4 px-4 py-3 border-b border-[var(--border-row)]/60 last:border-0">
      <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
        {label}
      </p>
      <p className={`text-base tabular-nums ${cellCls(aWins)}`}>{valA}</p>
      <p className={`text-base tabular-nums ${cellCls(bWins)}`}>{valB}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison table
// ─────────────────────────────────────────────────────────────────────────────

function ComparisonTable({
  teamA,
  teamB,
  statsA,
  statsB,
  onShowMore,
}: {
  teamA:      Team;
  teamB:      Team;
  statsA:     TeamStats;
  statsB:     TeamStats;
  onShowMore: () => void;
}) {
  const colorA = TEAM_COLORS[teamA.code] ?? "#3b82f6";
  const colorB = TEAM_COLORS[teamB.code] ?? "#3b82f6";
  const isChampA = statsA.stage === "Champions";
  const isChampB = statsB.stage === "Champions";

  return (
    <div className="bg-[var(--bg-card)]/60 border border-[var(--border-card)] rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-4 px-4 py-3 bg-[var(--bg-darker)]/60 border-b border-[var(--border-card)]">
        <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
          Metric
        </p>
        <div className="flex items-center gap-2">
          <Flag code={teamA.code} size="md" />
          <span className="text-white font-bold text-sm truncate">{teamA.name}</span>
          {isChampA && <Trophy className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-2">
          <Flag code={teamB.code} size="md" />
          <span className="text-white font-bold text-sm truncate">{teamB.name}</span>
          {isChampB && <Trophy className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
        </div>
      </div>

      {/* Stat rows */}
      <StatRow label="Final Result"   valA={statsA.stage}         valB={statsB.stage}         highlightHigher={false} />
      <StatRow label="Matches Played" valA={statsA.played}        valB={statsB.played}        highlightHigher={false} />
      <StatRow label="Wins"           valA={statsA.wins}          valB={statsB.wins}          />
      <StatRow label="Draws"          valA={statsA.draws}         valB={statsB.draws}         highlightHigher={false} />
      <StatRow label="Losses"         valA={statsA.losses}        valB={statsB.losses}        highlightHigher={false} />
      <StatRow label="Goals Scored"   valA={statsA.goalsScored}   valB={statsB.goalsScored}   />
      <StatRow label="Goals Conceded" valA={statsA.goalsConceded} valB={statsB.goalsConceded} highlightHigher={false} />
      <StatRow label="Clean Sheets"   valA={statsA.cleanSheets}   valB={statsB.cleanSheets}   />
      <StatRow
        label="Top Scorer"
        valA={statsA.topScorer ? `${statsA.topScorer.name} (${statsA.topScorer.goals})` : "—"}
        valB={statsB.topScorer ? `${statsB.topScorer.name} (${statsB.topScorer.goals})` : "—"}
        highlightHigher={false}
      />

      {/* Bottom team-color bar */}
      <div
        className="h-1 w-full"
        style={{
          background: `linear-gradient(to right, ${colorA}, ${colorA}33 50%, ${colorB}33 50%, ${colorB})`,
        }}
      />

      {/* Show more stats CTA */}
      <div className="px-4 py-3 bg-[var(--bg-darker)]/40 border-t border-[var(--border-card)] flex items-center justify-end">
        <button
          type="button"
          onClick={onShowMore}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-full border bg-[var(--accent-500)]/10 border-[var(--accent-500)]/40 text-[var(--accent-300)] hover:bg-[var(--accent-500)]/20 hover:border-[var(--accent-500)]/60 transition-colors"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Show more stats
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function TeamComparison({
  payload,
}: {
  payload: TeamComparisonPayload;
}) {
  const squads = useSquads();
  const [teamA, setTeamA] = useState<string | null>(null);
  const [teamB, setTeamB] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const teamObjA = teamA ? ALL_TEAMS.find((t) => t.code === teamA) ?? null : null;
  const teamObjB = teamB ? ALL_TEAMS.find((t) => t.code === teamB) ?? null : null;

  const statsA = useMemo(() => (teamA ? computeTeamStats(teamA, payload, squads) : null), [teamA, payload, squads]);
  const statsB = useMemo(() => (teamB ? computeTeamStats(teamB, payload, squads) : null), [teamB, payload, squads]);

  const clear = () => { setTeamA(null); setTeamB(null); };

  return (
    <div className="bg-[var(--bg-card)]/60 border border-[var(--border-card)] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <ArrowLeftRight className="w-4 h-4 text-[var(--accent-400)]" />
        <h3 className="text-white font-bold text-base">Team Comparison</h3>
      </div>
      <p className="text-gray-500 text-xs mb-4">
        Pick two teams to compare their tournament stats side-by-side
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3 mb-5">
        <TeamPicker
          value={teamA}
          onChange={setTeamA}
          excluded={teamB}
          placeholder="Pick a team"
        />
        <span className="hidden sm:inline text-gray-600 text-xs font-black tracking-widest uppercase px-1">vs</span>
        <TeamPicker
          value={teamB}
          onChange={setTeamB}
          excluded={teamA}
          placeholder="Pick another team"
        />
      </div>

      {(teamA || teamB) && (
        <button
          type="button"
          onClick={clear}
          className="text-gray-500 hover:text-white text-[11px] font-semibold uppercase tracking-wider mb-4 transition-colors"
        >
          Clear
        </button>
      )}

      {teamObjA && teamObjB && statsA && statsB ? (
        <ComparisonTable
          teamA={teamObjA}
          teamB={teamObjB}
          statsA={statsA}
          statsB={statsB}
          onShowMore={() => setShowMore(true)}
        />
      ) : (
        <p className="text-gray-500 text-sm italic px-1 py-6 text-center">
          Pick two teams above to see the comparison table.
        </p>
      )}

      {showMore && teamObjA && teamObjB && statsA && statsB && (
        <TeamStatsModal
          teamA={teamObjA}
          teamB={teamObjB}
          statsA={statsA}
          statsB={statsB}
          payload={payload}
          onClose={() => setShowMore(false)}
        />
      )}
    </div>
  );
}
