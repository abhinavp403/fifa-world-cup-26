"use client";

/**
 * Expanded "Show more stats" modal for two teams.
 *
 * Implements four tabs:
 *   1. Cumulative Totals   — mirrored bar chart
 *   2. Team Profile        — dumbbell/lollipop chart, normalized across all teams
 *                            using per-game rates (so a 3-match team can be
 *                            compared fairly to a 7-match team)
 *   3. Per-Game Efficiency — mirrored bar chart, per-game rates
 *   4. Full Stats Table    — totals + per-game side-by-side
 *
 * Charts are canvas-drawn, no external library, ported from the
 * fifa-team-comparison skill (see references/chart-functions.md).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, BarChart3, GitCompare, Activity, Table2, Trophy } from "lucide-react";

import { GROUPS, TEAM_COLORS, type Team } from "@/lib/worldcup";
import { useSquads } from "@/lib/squadsContext";
import type { TeamStats, TeamComparisonPayload } from "@/components/TeamComparison";
import { computeTeamStats } from "@/components/TeamComparison";
import Flag from "@/components/Flag";

const ALL_TEAMS = GROUPS.flatMap((g) => g.teams);

// ─────────────────────────────────────────────────────────────────────────────
// Stat helpers
// ─────────────────────────────────────────────────────────────────────────────

type Row = { label: string; va: number; vb: number; unit?: string; inv?: boolean };

const safe = (num: number, den: number) => (den > 0 ? num / den : 0);
const pg   = (val: number, gp: number) => safe(val, gp); // per-game
const pct  = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

function cumulativeRows(a: TeamStats, b: TeamStats): Row[] {
  return [
    { label: "Goals Scored",    va: a.goalsScored,   vb: b.goalsScored                    },
    { label: "Goals Conceded",  va: a.goalsConceded, vb: b.goalsConceded, inv: true       },
    { label: "Total Shots",     va: a.shots,         vb: b.shots                          },
    { label: "Shots on Target", va: a.shotsOnTarget, vb: b.shotsOnTarget                  },
    { label: "Shot Accuracy",   va: pct(a.shotsOnTarget, a.shots),
                                 vb: pct(b.shotsOnTarget, b.shots), unit: "%"             },
    { label: "Conversion Rate", va: pct(a.goalsScored, a.shots),
                                 vb: pct(b.goalsScored, b.shots),   unit: "%"             },
    { label: "Clean Sheets",    va: a.cleanSheets,   vb: b.cleanSheets                    },
    { label: "Key Passes",      va: a.keyPasses,     vb: b.keyPasses                      },
    { label: "Tackles",         va: a.tackles,       vb: b.tackles                        },
    { label: "Interceptions",   va: a.interceptions, vb: b.interceptions                  },
    { label: "Fouls Committed", va: a.fouls,         vb: b.fouls,         inv: true       },
    { label: "Yellow Cards",    va: a.yellowCards,   vb: b.yellowCards,   inv: true       },
  ];
}

function efficiencyRows(a: TeamStats, b: TeamStats): Row[] {
  const passAcc = (t: TeamStats) => pct(t.passesAccurate, t.passes);
  return [
    { label: "Goals / game",        va: +pg(a.goalsScored, a.played).toFixed(2),
                                     vb: +pg(b.goalsScored, b.played).toFixed(2)                  },
    { label: "Conceded / game",     va: +pg(a.goalsConceded, a.played).toFixed(2),
                                     vb: +pg(b.goalsConceded, b.played).toFixed(2),   inv: true   },
    { label: "Shots / game",        va: +pg(a.shots, a.played).toFixed(1),
                                     vb: +pg(b.shots, b.played).toFixed(1)                        },
    { label: "Shot accuracy",       va: pct(a.shotsOnTarget, a.shots),
                                     vb: pct(b.shotsOnTarget, b.shots),               unit: "%"   },
    { label: "Possession",          va: Math.round(a.possession),
                                     vb: Math.round(b.possession),                   unit: "%"   },
    { label: "Passes / game",       va: +pg(a.passes, a.played).toFixed(1),
                                     vb: +pg(b.passes, b.played).toFixed(1)                       },
    { label: "Pass Acc %",          va: passAcc(a),
                                     vb: passAcc(b),                                 unit: "%"   },
    { label: "Corners / game",      va: +pg(a.corners, a.played).toFixed(1),
                                     vb: +pg(b.corners, b.played).toFixed(1)                      },
    { label: "Saves / game",        va: +pg(a.saves, a.played).toFixed(1),
                                     vb: +pg(b.saves, b.played).toFixed(1)                        },
    { label: "Dribbles / game",     va: +pg(a.dribbles, a.played).toFixed(1),
                                     vb: +pg(b.dribbles, b.played).toFixed(1)                     },
    { label: "Tackles / game",      va: +pg(a.tackles, a.played).toFixed(1),
                                     vb: +pg(b.tackles, b.played).toFixed(1)                      },
    { label: "Fouls / game",        va: +pg(a.fouls, a.played).toFixed(1),
                                     vb: +pg(b.fouls, b.played).toFixed(1),           inv: true   },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas drawing (ported from skill)
// ─────────────────────────────────────────────────────────────────────────────

// Default chart palette (matches dark themes). Each draw function reads
// theme-aware CSS variables at draw time so light theme picks up dark text.
const FALLBACK_GRID  = "#1a2a3e";
const FALLBACK_MUTED = "#3a5070";
const FALLBACK_TEXT  = "#c8daf0";

function readChartColors(el: Element) {
  const cs = getComputedStyle(el);
  const get = (k: string, fb: string) => {
    const v = cs.getPropertyValue(k).trim();
    return v || fb;
  };
  return {
    GRID:  get("--chart-grid",  FALLBACK_GRID),
    MUTED: get("--chart-muted", FALLBACK_MUTED),
    TEXT:  get("--chart-text",  FALLBACK_TEXT),
  };
}

function drawMirroredBars(
  canvas: HTMLCanvasElement,
  rows:   Row[],
  header: [string, string],
  colorA: string,
  colorB: string,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const COL = readChartColors(canvas);
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;
  const rowH = 36, topPad = 44, barMax = 260;
  const H = topPad + rows.length * rowH + 24;

  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = H + "px";
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  // headers
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = colorA;
  ctx.fillText(header[0], cx - 140, 24);
  ctx.fillStyle = colorB;
  ctx.fillText(header[1], cx + 140, 24);

  rows.forEach((s, i) => {
    const y = topPad + i * rowH;
    const maxV = Math.max(s.va, s.vb) || 1;

    // center label
    ctx.fillStyle = COL.MUTED;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(s.label, cx, y + 18);

    // bar A (grows left) — always the team's own color for consistency
    const wA = Math.round((s.va / maxV) * barMax * 0.42);
    ctx.fillStyle = colorA;
    ctx.beginPath();
    ctx.roundRect(cx - wA - 78, y + 4, wA, 22, 4);
    ctx.fill();
    ctx.fillStyle = COL.TEXT;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${s.va}${s.unit ?? ""}`, cx - 82, y + 19);

    // bar B (grows right) — always the team's own color for consistency
    const wB = Math.round((s.vb / maxV) * barMax * 0.42);
    ctx.fillStyle = colorB;
    ctx.beginPath();
    ctx.roundRect(cx + 78, y + 4, wB, 22, 4);
    ctx.fill();
    ctx.fillStyle = COL.TEXT;
    ctx.textAlign = "left";
    ctx.fillText(`${s.vb}${s.unit ?? ""}`, cx + 82 + wB, y + 19);
  });
}

function drawDumbbell(
  canvas: HTMLCanvasElement,
  a:      TeamStats,
  b:      TeamStats,
  all:    TeamStats[],
  labelA: string,
  labelB: string,
  colorA: string,
  colorB: string,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const COL = readChartColors(canvas);
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth;

  const safeGp = (t: TeamStats) => Math.max(1, t.played);

  type Metric = {
    label:  string;
    va:     number;
    vb:     number;
    values: number[];
    fmt:    (v: number) => string;
    invert?: boolean; // true when a lower raw value is "better" (e.g. conceded)
  };

  // Same six dimensions as before, normalized across every team with squad
  // data — but each metric now keeps its own readable raw value/unit so the
  // chart can label exact numbers instead of an abstract polygon shape.
  const metrics: Metric[] = [
    {
      label:  "Goals / game",
      va: a.goalsScored / safeGp(a), vb: b.goalsScored / safeGp(b),
      values: all.map((t) => t.goalsScored / safeGp(t)),
      fmt: (v) => v.toFixed(2),
    },
    {
      label:  "Shots / game",
      va: a.shots / safeGp(a), vb: b.shots / safeGp(b),
      values: all.map((t) => t.shots / safeGp(t)),
      fmt: (v) => v.toFixed(1),
    },
    {
      label:  "Shot Accuracy",
      va: pct(a.shotsOnTarget, a.shots), vb: pct(b.shotsOnTarget, b.shots),
      values: all.map((t) => pct(t.shotsOnTarget, t.shots)),
      fmt: (v) => `${Math.round(v)}%`,
    },
    {
      label:  "Conceded / game",
      va: a.goalsConceded / safeGp(a), vb: b.goalsConceded / safeGp(b),
      values: all.map((t) => t.goalsConceded / safeGp(t)),
      fmt: (v) => v.toFixed(2),
      invert: true, // fewer conceded = stronger defense
    },
    {
      label:  "Key Passes / game",
      va: a.keyPasses / safeGp(a), vb: b.keyPasses / safeGp(b),
      values: all.map((t) => t.keyPasses / safeGp(t)),
      fmt: (v) => v.toFixed(1),
    },
    {
      label:  "Possession",
      va: a.possession, vb: b.possession,
      values: all.map((t) => t.possession),
      fmt: (v) => `${Math.round(v)}%`,
    },
  ];

  const rng = (arr: number[]): [number, number] => {
    const lo = Math.min(...arr), hi = Math.max(...arr);
    return [lo, hi === lo ? hi + 1 : hi];
  };
  // Normalized 0–1 "strength" position along the track — always oriented so
  // that further right = stronger, regardless of whether the raw stat is a
  // "more is better" or "less is better" metric.
  const strength = (v: number, [lo, hi]: [number, number], invert?: boolean) => {
    const n = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    return invert ? 1 - n : n;
  };

  const rowH = 60, topPad = 54, leftPad = 142, rightPad = 28;
  const trackW = Math.max(120, W - leftPad - rightPad);
  const H = topPad + metrics.length * rowH + 22;

  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = H + "px";
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  // ── Legend + scale hint ──
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = colorA;
  ctx.beginPath(); ctx.arc(leftPad + 6, 22, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillText(labelA, leftPad + 16, 27);
  const wA = ctx.measureText(labelA).width;
  const bx = leftPad + 16 + wA + 26;
  ctx.fillStyle = colorB;
  ctx.beginPath(); ctx.arc(bx, 22, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillText(labelB, bx + 10, 27);

  ctx.fillStyle = COL.MUTED;
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("weaker  →  stronger (vs. all WC squads)", leftPad + trackW, 27);

  metrics.forEach((m, i) => {
    const y = topPad + i * rowH + rowH / 2;
    const range = rng(m.values);
    const sa = strength(m.va, range, m.invert);
    const sb = strength(m.vb, range, m.invert);
    const xA = leftPad + sa * trackW;
    const xB = leftPad + sb * trackW;

    // Row label
    ctx.fillStyle = COL.TEXT;
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(m.label, leftPad - 18, y + 4);

    // Background track
    ctx.strokeStyle = COL.GRID;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftPad, y);
    ctx.lineTo(leftPad + trackW, y);
    ctx.stroke();

    // Connector between the two dots
    ctx.strokeStyle = COL.MUTED;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(xA, y);
    ctx.lineTo(xB, y);
    ctx.stroke();

    // Dot + value label for A (above the line)
    ctx.fillStyle = colorA;
    ctx.beginPath(); ctx.arc(xA, y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(m.fmt(m.va), xA, y - 14);

    // Dot + value label for B (below the line)
    ctx.fillStyle = colorB;
    ctx.beginPath(); ctx.arc(xB, y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillText(m.fmt(m.vb), xB, y + 23);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab content components
// ─────────────────────────────────────────────────────────────────────────────

function ChartCanvas({
  draw,
}: {
  draw: (canvas: HTMLCanvasElement) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    draw(cv);
    const onResize = () => draw(cv);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);
  return <canvas ref={ref} className="w-full block" />;
}

function FullStatsTable({
  teamA, teamB, statsA, statsB,
}: {
  teamA:  Team; teamB:  Team;
  statsA: TeamStats; statsB: TeamStats;
}) {
  const colA = TEAM_COLORS[teamA.code] ?? "#3b82f6";
  const colB = TEAM_COLORS[teamB.code] ?? "#3b82f6";
  const a = statsA, b = statsB;
  const gd = (s: TeamStats) =>
    (s.goalsScored - s.goalsConceded >= 0 ? "+" : "") + (s.goalsScored - s.goalsConceded);

  const passAcc = (t: TeamStats) =>
    t.passes > 0 ? `${Math.round((t.passesAccurate / t.passes) * 100)}%` : "—";

  // Fixture-aggregate fields (not yet wired to a per-match aggregation
  // pipeline — same "0 = no data" convention as Avg possession/Total corners).
  const dash    = (v: number) => (v > 0 ? v : "—");
  const dashPct = (v: number) => (v > 0 ? `${Math.round(v)}%` : "—");

  const sections: { title: string; rows: [string, string|number, string|number][] }[] = [
    {
      title: "Overall",
      rows: [
        ["Stage reached",  a.stage,  b.stage],
        ["Matches played", a.played, b.played],
        ["Wins",           a.wins,   b.wins],
        ["Draws",          a.draws,  b.draws],
        ["Losses",         a.losses, b.losses],
      ],
    },
    {
      title: "Goals & Shooting",
      rows: [
        ["Goals scored",     a.goalsScored,   b.goalsScored],
        ["Goals conceded",   a.goalsConceded, b.goalsConceded],
        ["Goal difference",  gd(a),           gd(b)],
        ["Total shots",      a.shots,         b.shots],
        ["Shots on target",  a.shotsOnTarget, b.shotsOnTarget],
        ["Shot accuracy",    `${pct(a.shotsOnTarget, a.shots)}%`, `${pct(b.shotsOnTarget, b.shots)}%`],
        ["Conversion rate",  `${pct(a.goalsScored, a.shots)}%`,   `${pct(b.goalsScored, b.shots)}%`],
        ["Shots inside box",  dash(a.shotsInsideBox),  dash(b.shotsInsideBox)],
        ["Shots outside box", dash(a.shotsOutsideBox), dash(b.shotsOutsideBox)],
        ["Hit woodwork",      dash(a.hitWoodwork),     dash(b.hitWoodwork)],
      ],
    },
    {
      title: "Passing & Possession",
      rows: [
        ["Avg possession",   a.possession > 0 ? `${Math.round(a.possession)}%` : "—",
                              b.possession > 0 ? `${Math.round(b.possession)}%` : "—"],
        ["Total corners",    a.corners > 0 ? a.corners : "—",
                              b.corners > 0 ? b.corners : "—"],
        ["Total passes",     a.passes,        b.passes],
        ["Pass accuracy",    passAcc(a),      passAcc(b)],
        ["Key passes",       a.keyPasses,     b.keyPasses],
        ["Long balls",       dash(a.longBalls), dash(b.longBalls)],
        ["Throw-ins",        dash(a.throwIns),  dash(b.throwIns)],
        ["Dispossessed",     dash(a.dispossessed),   dash(b.dispossessed)],
        ["Dribbles %",       dashPct(a.dribblesPct), dashPct(b.dribblesPct)],
      ],
    },
    {
      title: "Defensive & Discipline",
      rows: [
        ["Clean sheets",     a.cleanSheets,   b.cleanSheets],
        ["Saves",            a.saves,         b.saves],
        ["Tackles",          a.tackles,       b.tackles],
        ["Tackles won %",    dashPct(a.tacklesWonPct), dashPct(b.tacklesWonPct)],
        ["Interceptions",    a.interceptions, b.interceptions],
        ["Recoveries",       dash(a.ballRecoveries), dash(b.ballRecoveries)],
        ["Duels won %",      dashPct(a.duelsPct),    dashPct(b.duelsPct)],
        ["Fouls committed",  a.fouls,         b.fouls],
        ["Yellow cards",     a.yellowCards,   b.yellowCards],
        ["Red cards",        a.redCards,      b.redCards],
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {sections.map((sec) => (
        <div
          key={sec.title}
          className="bg-[var(--bg-card)]/60 border border-[var(--border-card)] rounded-xl overflow-hidden"
        >
          <div className="px-5 py-3 bg-[var(--bg-darker)]/60 border-b border-[var(--border-card)]">
            <p className="text-xs font-black tracking-widest text-gray-500 uppercase">
              {sec.title}
            </p>
          </div>
          {sec.rows.map(([label, av, bv]) => (
            <div
              key={label}
              className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-4 px-5 py-3 border-b border-[var(--border-row)]/60 last:border-0"
            >
              <p className="text-sm text-gray-400 font-semibold">{label}</p>
              <p className="text-base tabular-nums font-bold" style={{ color: colA }}>{av}</p>
              <p className="text-base tabular-nums font-bold" style={{ color: colB }}>{bv}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "cumulative" | "profile" | "efficiency" | "table";

const TABS: { id: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { id: "cumulative", label: "Cumulative Totals", Icon: BarChart3 },
  { id: "profile",    label: "Team Profile",      Icon: GitCompare },
  { id: "efficiency", label: "Per-Game",          Icon: Activity  },
  { id: "table",      label: "Full Table",        Icon: Table2    },
];

export default function TeamStatsModal({
  teamA,
  teamB,
  statsA,
  statsB,
  payload,
  onClose,
}: {
  teamA:   Team;
  teamB:   Team;
  statsA:  TeamStats;
  statsB:  TeamStats;
  payload: TeamComparisonPayload;
  onClose: () => void;
}) {
  const squads = useSquads();
  const [tab, setTab] = useState<Tab>("cumulative");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Stats for every team that has squad data — needed so the profile chart
  // can normalize each metric across the field, not just the two selected.
  const allStats = useMemo<TeamStats[]>(
    () =>
      ALL_TEAMS.filter((t) => squads[t.code]).map((t) =>
        computeTeamStats(t.code, payload, squads),
      ),
    [payload, squads],
  );

  const colorA = TEAM_COLORS[teamA.code] ?? "#3b82f6";
  const colorB = TEAM_COLORS[teamB.code] ?? "#3b82f6";
  const labelA = teamA.name;
  const labelB = teamB.name;

  // Stable draw callbacks per tab so the canvas redraws on resize.
  const drawCumulative = useMemo(
    () => (cv: HTMLCanvasElement) =>
      drawMirroredBars(cv, cumulativeRows(statsA, statsB), [labelA, labelB], colorA, colorB),
    [statsA, statsB, labelA, labelB, colorA, colorB],
  );
  const drawEff = useMemo(
    () => (cv: HTMLCanvasElement) =>
      drawMirroredBars(cv, efficiencyRows(statsA, statsB),
        [`${labelA} (${statsA.played}g)`, `${labelB} (${statsB.played}g)`], colorA, colorB),
    [statsA, statsB, labelA, labelB, colorA, colorB],
  );
  const drawProfileCb = useMemo(
    () => (cv: HTMLCanvasElement) =>
      drawDumbbell(cv, statsA, statsB, allStats, labelA, labelB, colorA, colorB),
    [statsA, statsB, allStats, labelA, labelB, colorA, colorB],
  );

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
        className="relative bg-[var(--bg-darker)] border border-[var(--border-strong)] sm:rounded-2xl w-full sm:max-w-6xl max-h-screen sm:max-h-[92vh] overflow-y-auto shadow-2xl"
      >
        <div
          className="h-1 w-full rounded-t-2xl flex-shrink-0"
          style={{
            background: `linear-gradient(to right, ${colorA}, ${colorA}33 50%, ${colorB}33 50%, ${colorB})`,
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

        <div className="px-5 sm:px-10 py-8">
          {/* Header */}
          <div className="mb-7">
            <p className="text-xs font-black tracking-widest uppercase text-[var(--accent-300)] mb-2">
              Extended Comparison
            </p>
            <div className="flex items-center gap-4 flex-wrap text-xl">
              <div className="flex items-center gap-2.5">
                <Flag code={teamA.code} size="lg" />
                <span className="text-white font-bold text-2xl">{teamA.name}</span>
                {statsA.stage === "Champions" && <Trophy className="w-5 h-5 text-amber-400" />}
              </div>
              <span className="text-gray-600 text-sm font-black tracking-widest uppercase">vs</span>
              <div className="flex items-center gap-2.5">
                <Flag code={teamB.code} size="lg" />
                <span className="text-white font-bold text-2xl">{teamB.name}</span>
                {statsB.stage === "Champions" && <Trophy className="w-5 h-5 text-amber-400" />}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-7">
            {TABS.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`inline-flex items-center gap-2 text-sm font-bold tracking-wider uppercase px-4 py-2 rounded-full border transition-colors ${
                    active
                      ? "tag-active text-white"
                      : "bg-[var(--bg-card)] border-[var(--border-card)] text-gray-400 hover:text-white hover:border-[var(--border-strong)]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tab body */}
          {tab === "cumulative" && (
            <>
              <p className="text-gray-500 text-sm italic mb-4">
                Raw tournament totals · brighter side leads (red on inverted stats like cards/conceded means worse)
              </p>
              <div className="bg-[var(--bg-card)]/60 border border-[var(--border-card)] rounded-xl p-5">
                <ChartCanvas draw={drawCumulative} />
              </div>
            </>
          )}

          {tab === "profile" && (
            <>
              <p className="text-gray-500 text-sm italic mb-4">
                Each metric plotted on its own scale, normalized across all teams with squad data — dots show real per-game values, and the side further right is the stronger one
              </p>
              <div className="bg-[var(--bg-card)]/60 border border-[var(--border-card)] rounded-xl p-5">
                <ChartCanvas draw={drawProfileCb} />
              </div>
            </>
          )}

          {tab === "efficiency" && (
            <>
              <p className="text-gray-500 text-sm italic mb-4">
                Every stat is per-game — the fairest head-to-head view when teams played different match counts
              </p>
              <div className="bg-[var(--bg-card)]/60 border border-[var(--border-card)] rounded-xl p-5">
                <ChartCanvas draw={drawEff} />
              </div>
            </>
          )}

          {tab === "table" && (
            <FullStatsTable
              teamA={teamA}
              teamB={teamB}
              statsA={statsA}
              statsB={statsB}
            />
          )}

          <p className="text-gray-700 text-xs text-center mt-6">
            WC 2026 stats only · charts update automatically as matches are played
          </p>
        </div>
      </motion.div>
    </div>
  );
}
