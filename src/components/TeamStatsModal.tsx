"use client";

/**
 * Expanded "Show more stats" modal for two teams.
 *
 * Implements four tabs:
 *   1. Cumulative Totals   — mirrored bar chart
 *   2. Profile Radar       — 6-axis spider, normalized across all teams
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
import { X, BarChart3, Radar, Activity, Table2, Trophy } from "lucide-react";

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

    // bar A (grows left)
    const wA = Math.round((s.va / maxV) * barMax * 0.42);
    const winsA = s.inv ? s.va <= s.vb : s.va >= s.vb;
    ctx.fillStyle = winsA ? colorA : "#1a3a60";
    if (s.inv && !winsA) ctx.fillStyle = "#9a3030";
    ctx.beginPath();
    ctx.roundRect(cx - wA - 78, y + 4, wA, 22, 4);
    ctx.fill();
    ctx.fillStyle = COL.TEXT;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${s.va}${s.unit ?? ""}`, cx - 82, y + 19);

    // bar B (grows right)
    const wB = Math.round((s.vb / maxV) * barMax * 0.42);
    const winsB = s.inv ? s.vb <= s.va : s.vb >= s.va;
    ctx.fillStyle = winsB ? colorB : "#604800";
    if (s.inv && !winsB) ctx.fillStyle = "#9a3030";
    ctx.beginPath();
    ctx.roundRect(cx + 78, y + 4, wB, 22, 4);
    ctx.fill();
    ctx.fillStyle = COL.TEXT;
    ctx.textAlign = "left";
    ctx.fillText(`${s.vb}${s.unit ?? ""}`, cx + 82 + wB, y + 19);
  });
}

function drawRadar(
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
  const H = 510;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = H + "px";
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H / 2 - 30; // shift radar up so bottom labels don't crowd legend
  const R  = Math.min(W * 0.34, 160);

  // Six axes, normalized across all teams' per-game rates.
  // dims: [goals/g, shots/g, shot_acc%, def_solidity, key_passes/g, possession%]
  const safeGp = (t: TeamStats) => Math.max(1, t.played);
  const axes = {
    gf:   all.map((t) => t.goalsScored / safeGp(t)),
    sh:   all.map((t) => t.shots / safeGp(t)),
    acc:  all.map((t) => pct(t.shotsOnTarget, t.shots)),
    def:  all.map((t) => 1 - t.goalsConceded / safeGp(t) / 3),
    kp:   all.map((t) => t.keyPasses / safeGp(t)),
    poss: all.map((t) => t.possession),
  };
  const rng = (arr: number[]): [number, number] => {
    const lo = Math.min(...arr), hi = Math.max(...arr);
    return [lo, hi === lo ? hi + 1 : hi];
  };
  const norm = (v: number, [lo, hi]: [number, number]) =>
    Math.max(0, Math.min(1, (v - lo) / (hi - lo)));

  const dims = (t: TeamStats): number[] => [
    norm(t.goalsScored / safeGp(t),                   rng(axes.gf)),
    norm(t.shots / safeGp(t),                          rng(axes.sh)),
    norm(pct(t.shotsOnTarget, t.shots),                rng(axes.acc)),
    norm(1 - t.goalsConceded / safeGp(t) / 3,          rng(axes.def)),
    norm(t.keyPasses / safeGp(t),                      rng(axes.kp)),
    norm(t.possession,                                 rng(axes.poss)),
  ];

  const labels = [
    ["Goals", "per game"],
    ["Shot",  "Volume"],
    ["Shot",  "Accuracy"],
    ["Defensive", "Solidity"],
    ["Key Passes", "per game"],
    ["Possession"],
  ];
  const n = 6;

  // Grid polygons
  for (let r = 0.2; r <= 1.0001; r += 0.2) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
      const x = cx + Math.cos(ang) * R * r;
      const y = cy + Math.sin(ang) * R * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = COL.GRID;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Radial axis lines
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
    ctx.strokeStyle = COL.GRID;
    ctx.stroke();
  }
  // Axis labels
  ctx.fillStyle = COL.MUTED;
  ctx.font = "13px system-ui, sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    const lx = cx + Math.cos(ang) * (R + 34);
    const ly = cy + Math.sin(ang) * (R + 34);
    labels[i].forEach((l, j) => ctx.fillText(l, lx, ly + j * 16));
  }

  // Polygon for one team
  const drawPoly = (d: number[], color: string) => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
      const x = cx + Math.cos(ang) * R * d[i];
      const y = cy + Math.sin(ang) * R * d[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color + "30";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(
        cx + Math.cos(ang) * R * d[i],
        cy + Math.sin(ang) * R * d[i],
        4, 0, Math.PI * 2,
      );
      ctx.fillStyle = color;
      ctx.fill();
    }
  };

  drawPoly(dims(a), colorA);
  drawPoly(dims(b), colorB);

  // Legend at bottom — pinned a bit further down to leave room beneath
  // the "Defensive Solidity" axis label
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.fillStyle = colorA;
  ctx.textAlign = "right";
  ctx.fillText(labelA, cx - 14, H - 22);
  ctx.fillStyle = colorB;
  ctx.textAlign = "left";
  ctx.fillText(labelB, cx + 14, H - 22);
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

type Tab = "cumulative" | "radar" | "efficiency" | "table";

const TABS: { id: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { id: "cumulative", label: "Cumulative Totals", Icon: BarChart3 },
  { id: "radar",      label: "Profile Radar",     Icon: Radar     },
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

  // Stats for every team that has squad data — needed so the radar can
  // normalize axes across the field rather than just the two selected.
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
  const drawRadarCb = useMemo(
    () => (cv: HTMLCanvasElement) =>
      drawRadar(cv, statsA, statsB, allStats, labelA, labelB, colorA, colorB),
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

          {tab === "radar" && (
            <>
              <p className="text-gray-500 text-sm italic mb-4">
                Each axis normalized across all teams with squad data, using per-game rates — a 3-match team is comparable to a 7-match team
              </p>
              <div className="bg-[var(--bg-card)]/60 border border-[var(--border-card)] rounded-xl p-5">
                <ChartCanvas draw={drawRadarCb} />
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
