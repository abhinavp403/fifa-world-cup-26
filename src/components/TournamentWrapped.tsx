"use client";

// Tournament Wrapped — a Spotify-Wrapped-style story recap of the World Cup.
// Full-screen overlay with auto-advancing slides: tournament totals, Golden
// Boot / Glove, best players, team superlatives and the wildest matches.
// Everything is computed client-side from the squads context (player stats)
// and the /api/worldcup payload (matches, bracket, team aggregates).

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Target,
  Wand2,
  Star,
  Shield,
  Flame,
  Rocket,
  Award,
  BarChart3,
  Sparkles,
} from "lucide-react";

import { GROUPS, type Team } from "@/lib/worldcup";
import { useSquads } from "@/lib/squadsContext";
import type { Match, Round } from "@/lib/bracket";
import type { ResolvedGroup } from "@/lib/resolver";
import type { TeamFixtureAggregate } from "@/lib/teamFixtureStats";
import type { PlayerStats } from "@/lib/squads";
import Flag from "@/components/Flag";

// ─────────────────────────────────────────────────────────────────────────────
// Data shapes
// ─────────────────────────────────────────────────────────────────────────────

export type WrappedSource = {
  groups: ResolvedGroup[];
  bracket: Round[];
  thirdPlace: Match;
  champion: Team | null;
  teamFixtureStats: Record<string, TeamFixtureAggregate>;
} | null;

type PlayerRow = {
  name: string;
  code: string;
  teamName: string;
  photo?: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  age: number;
  stats: PlayerStats;
};

type FinishedMatch = {
  homeCode: string;
  awayCode: string;
  homeName: string;
  awayName: string;
  hs: number;
  as: number;
  round: string;
};

const TEAM_BY_CODE: Record<string, Team> = Object.fromEntries(
  GROUPS.flatMap((g) => g.teams.map((t) => [t.code, t])),
);

const SLIDE_MS = 12_000;
const TOTAL_MATCHES = 104;
const TOURNAMENT_YEAR = 2026;

// ─────────────────────────────────────────────────────────────────────────────
// Stat computation
// ─────────────────────────────────────────────────────────────────────────────

function collectFinishedMatches(data: WrappedSource): FinishedMatch[] {
  if (!data) return [];
  const out: FinishedMatch[] = [];

  for (const g of data.groups ?? []) {
    for (const m of g.matches ?? []) {
      if (m.homeScore == null || m.awayScore == null) continue;
      if (m.status !== "FINISHED") continue;
      out.push({
        homeCode: m.homeCode, awayCode: m.awayCode,
        homeName: m.homeName, awayName: m.awayName,
        hs: m.homeScore, as: m.awayScore,
        round: `Group ${g.letter}`,
      });
    }
  }

  const bracketMatches: { m: Match; round: string }[] = [
    ...(data.bracket ?? []).flatMap((r) => r.matches.map((m) => ({ m, round: r.name }))),
    ...(data.thirdPlace ? [{ m: data.thirdPlace, round: "Third Place" }] : []),
  ];
  for (const { m, round } of bracketMatches) {
    const home = m.slot1.team, away = m.slot2.team;
    if (!home || !away || m.homeScore == null || m.awayScore == null) continue;
    if (m.status !== "FINISHED") continue;
    out.push({
      homeCode: home.code, awayCode: away.code,
      homeName: home.name, awayName: away.name,
      hs: m.homeScore, as: m.awayScore,
      round,
    });
  }

  return out;
}

function usePlayers(): PlayerRow[] {
  const squads = useSquads();
  return useMemo(
    () =>
      Object.entries(squads).flatMap(([code, squad]) =>
        squad.players
          .filter((p) => p.stats && p.stats.minutesPlayed > 0)
          .map((p) => ({
            name: p.name,
            code,
            teamName: TEAM_BY_CODE[code]?.name ?? code,
            photo: p.photo,
            position: p.position,
            age: p.age,
            stats: p.stats!,
          })),
      ),
    [squads],
  );
}

function top<T>(rows: T[], score: (r: T) => number, tiebreak?: (r: T) => number, n = 5): T[] {
  return [...rows]
    .filter((r) => score(r) > 0)
    .sort((a, b) => score(b) - score(a) || (tiebreak ? tiebreak(b) - tiebreak(a) : 0))
    .slice(0, n);
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated football backdrops
// ─────────────────────────────────────────────────────────────────────────────

type FxVariant = "pitch" | "balls" | "net" | "confetti" | "none";

// Deterministic layouts (no Math.random in render → stable across re-renders).
const FLOAT_BALLS = [
  { left: "6%",  size: 34, dur: 16, delay: 0   },
  { left: "22%", size: 20, dur: 11, delay: 2.5 },
  { left: "43%", size: 46, dur: 20, delay: 5   },
  { left: "61%", size: 24, dur: 13, delay: 1   },
  { left: "78%", size: 38, dur: 18, delay: 7   },
  { left: "90%", size: 18, dur: 10, delay: 4   },
];

const CONFETTI = [
  { left: "4%",  color: "#fde047", dur: 5.5, delay: 0,   size: 10 },
  { left: "12%", color: "#ffffff", dur: 4.2, delay: 1.2, size: 8  },
  { left: "21%", color: "#4ade80", dur: 6.1, delay: 0.6, size: 12 },
  { left: "30%", color: "#60a5fa", dur: 4.8, delay: 2.1, size: 9  },
  { left: "38%", color: "#f472b6", dur: 5.9, delay: 0.3, size: 11 },
  { left: "47%", color: "#fde047", dur: 4.5, delay: 1.8, size: 8  },
  { left: "55%", color: "#ffffff", dur: 6.4, delay: 0.9, size: 10 },
  { left: "64%", color: "#fb923c", dur: 4.9, delay: 2.6, size: 12 },
  { left: "72%", color: "#4ade80", dur: 5.3, delay: 0.1, size: 9  },
  { left: "81%", color: "#60a5fa", dur: 6.0, delay: 1.5, size: 11 },
  { left: "89%", color: "#f472b6", dur: 4.4, delay: 2.9, size: 8  },
  { left: "96%", color: "#fde047", dur: 5.7, delay: 0.7, size: 10 },
];

function SlideFX({ variant }: { variant: FxVariant }) {
  if (variant === "none") return null;

  if (variant === "balls") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        {FLOAT_BALLS.map((b, i) => (
          <motion.span
            key={i}
            className="absolute -bottom-14 opacity-20 select-none"
            style={{ left: b.left, fontSize: b.size }}
            animate={{ y: [0, -1100], rotate: [0, 480] }}
            transition={{ repeat: Infinity, duration: b.dur, delay: b.delay, ease: "linear" }}
          >
            ⚽
          </motion.span>
        ))}
      </div>
    );
  }

  if (variant === "pitch") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        {/* mowed-grass stripes */}
        <div className="absolute inset-0 opacity-60 [background:repeating-linear-gradient(90deg,rgba(255,255,255,0.05)_0_48px,transparent_48px_96px)]" />
        {/* pitch markings */}
        <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="50" y1="0" x2="50" y2="100" stroke="white" strokeWidth="0.4" />
          <circle cx="50" cy="50" r="16" fill="none" stroke="white" strokeWidth="0.4" />
          <rect x="0" y="28" width="14" height="44" fill="none" stroke="white" strokeWidth="0.4" />
          <rect x="86" y="28" width="14" height="44" fill="none" stroke="white" strokeWidth="0.4" />
        </svg>
        {/* ball rolling along the bottom */}
        <motion.span
          className="absolute bottom-6 text-3xl select-none opacity-40"
          animate={{ left: ["-8%", "104%"], rotate: [0, 1080] }}
          transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
        >
          ⚽
        </motion.span>
      </div>
    );
  }

  if (variant === "net") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        {/* goal-net mesh */}
        <motion.div
          className="absolute -inset-6 opacity-[0.13] [background:linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:34px_34px]"
          animate={{ skewX: [-1.5, 1.5, -1.5], x: [-4, 4, -4] }}
          transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
        />
        {/* ball bouncing across */}
        <motion.span
          className="absolute text-4xl select-none opacity-35"
          style={{ bottom: 24 }}
          animate={{
            left: ["-10%", "106%"],
            y: [0, -180, 0, -120, 0, -70, 0],
            rotate: [0, 720],
          }}
          transition={{ repeat: Infinity, duration: 9, ease: "linear" }}
        >
          ⚽
        </motion.span>
      </div>
    );
  }

  // confetti
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {CONFETTI.map((c, i) => (
        <motion.span
          key={i}
          className="absolute -top-4 rounded-[2px]"
          style={{ left: c.left, width: c.size, height: c.size * 0.45, backgroundColor: c.color }}
          animate={{ y: [0, 1050], rotate: [0, i % 2 ? 540 : -540], opacity: [0.9, 0.9, 0.4] }}
          transition={{ repeat: Infinity, duration: c.dur, delay: c.delay, ease: "linear" }}
        />
      ))}
      <motion.span
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-5xl select-none opacity-30"
        animate={{ y: [0, -18, 0], rotate: [-8, 8, -8] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
      >
        ⚽
      </motion.span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide chrome
// ─────────────────────────────────────────────────────────────────────────────

function SlideShell({
  eyebrow,
  icon,
  children,
}: {
  eyebrow: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full px-7 pt-16 pb-12">
      <div className="mb-5">
        <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
      </div>
      <div className="flex-1 flex flex-col justify-center min-h-0">{children}</div>
    </div>
  );
}

// Slide title chip — bold pill that stays legible over any backdrop.
function Eyebrow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2.5 bg-black/45 backdrop-blur-md border border-white/25 rounded-full pl-2 pr-5 py-1.5 shadow-[0_4px_18px_rgba(0,0,0,0.35)]">
      <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white">
        {icon}
      </span>
      <span className="text-white text-sm sm:text-base font-black tracking-[0.2em] uppercase drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
        {children}
      </span>
    </div>
  );
}

// Full-bleed video backdrop with the leaders animating in one at a time,
// stacked in the bottom-right corner. "swish" slides in from the right;
// "pop" zooms each row up from a dot with a springy overshoot.
const LEADER_ROW_ANIMS = {
  swish: {
    initial: { x: 320, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    transition: { type: "spring", stiffness: 210, damping: 20 },
  },
  pop: {
    initial: { scale: 0.2, opacity: 0, rotate: -6 },
    animate: { scale: 1, opacity: 1, rotate: 0 },
    transition: { type: "spring", stiffness: 260, damping: 14 },
  },
  // dropped from above and caught with a bounce — very goalkeeper
  drop: {
    initial: { y: -260, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { type: "spring", stiffness: 300, damping: 13 },
  },
} as const;

function VideoLeadersSlide({
  src,
  eyebrow,
  icon,
  rows,
  footnote,
  anim = "swish",
  tint,
}: {
  src: string;
  eyebrow: string;
  icon: React.ReactNode;
  rows: { key: string; code: string; label: string; display: string }[];
  footnote?: string;
  anim?: keyof typeof LEADER_ROW_ANIMS;
  tint: string;
}) {
  const rowAnim = LEADER_ROW_ANIMS[anim];
  return (
    <div className="relative h-full">
      <video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* color tint + dark edges keep the eyebrow and rows readable over the footage */}
      <div className={`absolute inset-0 bg-gradient-to-br ${tint}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/40" />

      <div className="relative h-full flex flex-col px-7 pt-16 pb-14">
        <div>
          <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
        </div>

        <div className="mt-auto flex flex-col items-end gap-2">
          {rows.map((r, i) => (
            <motion.div
              key={r.key}
              initial={rowAnim.initial}
              animate={rowAnim.animate}
              transition={{ ...rowAnim.transition, delay: 0.5 + i * 0.45 }}
              className="flex items-center gap-3 bg-black/55 backdrop-blur-sm rounded-xl pl-3.5 pr-4 py-2.5 min-w-[230px] origin-bottom-right"
            >
              <span className="text-white/60 font-black text-sm w-4 text-center">{i + 1}</span>
              <Flag code={r.code} size="md" />
              <span className="text-white font-bold text-sm truncate flex-1">{r.label}</span>
              <span className="text-amber-300 font-black text-lg tabular-nums leading-none">
                {r.display}
              </span>
            </motion.div>
          ))}
          {footnote && (
            <p className="text-white/60 text-[11px] font-semibold mt-1.5">{footnote}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Goal machines: team-photo backdrop under a warm gradient, with the top
// attacking teams flipping up into place one at a time in the bottom-right.
function GoalMachinesSlide({
  headline,
  rows,
}: {
  headline: string;
  rows: { key: string; code: string; label: string; display: string }[];
}) {
  return (
    <div className="relative h-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/goalmachines.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* gradient overlay: warm brand tint + dark edges for readable copy */}
      <div className="absolute inset-0 bg-gradient-to-br from-rose-600/70 via-red-900/45 to-orange-600/60" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/45" />

      <div className="relative h-full flex flex-col px-7 pt-16 pb-14">
        <div className="mb-5">
          <Eyebrow icon={<Flame className="w-4 h-4" />}>Goal machines</Eyebrow>
        </div>

        <div className="text-white font-black text-3xl sm:text-4xl leading-tight tracking-tight max-w-md drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
          {headline}
        </div>

        <div className="mt-auto flex flex-col items-end gap-2 [perspective:800px]">
          {rows.map((r, i) => (
            <motion.div
              key={r.key}
              initial={{ opacity: 0, y: 48, rotateX: -90, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.4, type: "spring", stiffness: 170, damping: 16 }}
              className="flex items-center gap-3 bg-black/55 backdrop-blur-sm rounded-xl pl-3.5 pr-4 py-2.5 min-w-[230px] origin-bottom"
            >
              <span className="text-white/60 font-black text-sm w-4 text-center">{i + 1}</span>
              <Flag code={r.code} size="md" />
              <span className="text-white font-bold text-sm truncate flex-1">{r.label}</span>
              <span className="text-orange-300 font-black text-lg tabular-nums leading-none">
                {r.display}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// The finale — a cinematic champion reveal: rotating spotlight rays, a trophy
// that drops in with a pulsing glow, the flag springing up, and a shimmering
// team name, each element staggered for a build-up.
function ChampionSlide({ champion }: { champion: Team }) {
  return (
    <div className="relative h-full flex flex-col items-center justify-center text-center px-8 overflow-hidden">
      {/* rotating spotlight rays */}
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 w-[150%] aspect-square -translate-x-1/2 -translate-y-1/2 opacity-25 [background:repeating-conic-gradient(rgba(255,255,255,0.55)_0deg_7deg,transparent_7deg_22deg)] [mask-image:radial-gradient(circle,black_0%,transparent_62%)]"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 44, ease: "linear" }}
      />
      {/* soft golden bloom behind everything */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] aspect-square rounded-full bg-amber-200/25 blur-3xl"
      />

      {/* trophy — drops in with a pulsing halo */}
      <motion.div
        initial={{ y: -130, scale: 0, rotate: -18, opacity: 0 }}
        animate={{ y: 0, scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 150, damping: 12, delay: 0.15 }}
        className="relative mb-5"
      >
        <motion.span
          aria-hidden
          className="absolute inset-0 -m-6 rounded-full bg-amber-100/50 blur-2xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.45, 0.9, 0.45] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
        />
        <Trophy
          className="relative w-20 h-20 sm:w-24 sm:h-24 text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
          strokeWidth={1.5}
        />
      </motion.div>

      {/* eyebrow label */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="text-white/90 text-sm sm:text-base font-black tracking-[0.35em] uppercase mb-5"
      >
        World Champions · {TOURNAMENT_YEAR}
      </motion.div>

      {/* flag — springs up */}
      <motion.div
        initial={{ scale: 0.3, opacity: 0, rotate: -6 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 210, damping: 13, delay: 0.7 }}
      >
        <Flag
          code={champion.code}
          size="lg"
          className="!h-16 !w-24 sm:!h-20 sm:!w-[128px] rounded-lg ring-4 ring-white/50 shadow-2xl"
        />
      </motion.div>

      {/* team name — shimmering gold-white gradient */}
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.55 }}
        className="mt-5 shine-text bg-gradient-to-r from-white via-amber-100 to-white bg-clip-text text-transparent font-black text-6xl sm:text-7xl tracking-tight leading-none"
      >
        {champion.name}
      </motion.div>

      {/* tagline */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3, duration: 0.6 }}
        className="mt-6 text-white/90 font-bold text-lg sm:text-xl max-w-sm"
      >
        Champions of the world. {TOURNAMENT_YEAR} belongs to them.
      </motion.p>
    </div>
  );
}

// Compact "record ledger" row: up to two flags in a fixed-width left slot (so
// the figure column stays aligned across every row), a bold accent figure, and
// a short caption separated by a hairline divider.
function RecordStat({
  code,
  code2,
  figure,
  children,
}: {
  code?: string;
  code2?: string;
  figure: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex items-center w-9 flex-shrink-0" aria-hidden>
        {code && <Flag code={code} size="sm" />}
        {code2 && <Flag code={code2} size="sm" className="-ml-1" />}
      </span>
      <span className="text-amber-300 font-black text-[15px] tabular-nums w-16 flex-shrink-0 text-right leading-none">
        {figure}
      </span>
      <span className="text-white/90 text-[12.5px] leading-snug border-l border-white/15 pl-3 [&_b]:text-white [&_b]:font-bold">
        {children}
      </span>
    </div>
  );
}

function BigNumber({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-white font-black text-6xl sm:text-7xl leading-none tabular-nums tracking-tight">
        {value}
      </div>
      <div className="text-white/75 text-sm font-bold mt-2 tracking-wide uppercase">{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function TournamentWrapped({
  data,
  onClose,
}: {
  data: WrappedSource;
  onClose: () => void;
}) {
  const players = usePlayers();

  const wrapped = useMemo(() => {
    const matches = collectFinishedMatches(data);
    const played = matches.length;
    const goals = matches.reduce((s, m) => s + m.hs + m.as, 0);

    // Per-team goals for / against.
    const teamGoals = new Map<string, { gf: number; ga: number; gp: number }>();
    const bump = (code: string, gf: number, ga: number) => {
      const t = teamGoals.get(code) ?? { gf: 0, ga: 0, gp: 0 };
      t.gf += gf; t.ga += ga; t.gp += 1;
      teamGoals.set(code, t);
    };
    matches.forEach((m) => { bump(m.homeCode, m.hs, m.as); bump(m.awayCode, m.as, m.hs); });

    const teamRows = [...teamGoals.entries()].map(([code, t]) => ({
      code,
      name: TEAM_BY_CODE[code]?.name ?? code,
      ...t,
    }));

    const attack = [...teamRows].sort((a, b) => b.gf - a.gf || a.ga - b.ga).slice(0, 5);

    return {
      matches, played, goals,
      perGame: played ? (goals / played).toFixed(2) : "0",
      scorers: top(players, (p) => p.stats.goals, (p) => p.stats.assists),
      assisters: top(players, (p) => p.stats.assists, (p) => p.stats.goals),
      best: top(players.filter((p) => p.stats.minutesPlayed >= 180), (p) => p.stats.rating),
      keepers: top(players.filter((p) => p.position === "GK"), (p) => p.stats.cleanSheets, (p) => p.stats.saves),
      kids: top(players.filter((p) => p.age <= 21 && p.stats.minutesPlayed >= 90), (p) => p.stats.rating),
      attack,
    };
  }, [data, players]);

  // ── Slides ────────────────────────────────────────────────────────────────
  const slides = useMemo(() => {
    const s: { id: string; bg: string; fx: FxVariant; ms?: number; node: React.ReactNode }[] = [];
    const w = wrapped;

    s.push({
      id: "intro",
      fx: "pitch",
      bg: "from-indigo-600 via-purple-600 to-fuchsia-600",
      node: (
        <SlideShell eyebrow="World Cup 2026 Wrapped" icon={<Sparkles className="w-4 h-4" />}>
          <div className="text-white font-black text-4xl sm:text-5xl leading-[1.05] tracking-tight mb-8">
            48 nations walked in.
            <br />
            Here&apos;s what they left behind.
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8">
            <BigNumber value={String(w.played)} label="Matches played" />
            <BigNumber value={String(w.goals)} label="Goals scored" />
            <BigNumber value={w.perGame} label="Goals per match" />
            <BigNumber value={`${Math.round((w.played / TOTAL_MATCHES) * 100)}%`} label="Of the tournament" />
          </div>
        </SlideShell>
      ),
    });

    s.push({
      id: "best_player",
      fx: "none",
      bg: "from-violet-600 via-purple-700 to-indigo-800",
      node: (
        <VideoLeadersSlide
          src="/potm.mp4"
          tint="from-violet-600/60 via-purple-900/35 to-indigo-700/55"
          eyebrow="Player of the tournament"
          icon={<Star className="w-4 h-4" />}
          rows={[
            { key: "ESP-Rodri", code: "ESP", label: "Rodri", display: "Golden Ball" },
          ]}
          footnote="Golden Ball — voted the tournament's standout player"
        />
      ),
    });

    if (w.scorers.length) {
      s.push({
        id: "golden_boot",
        fx: "none",
        bg: "from-amber-500 via-orange-600 to-red-600",
        node: (
          <VideoLeadersSlide
            src="/goldenboot.mp4"
            tint="from-amber-500/60 via-orange-900/35 to-red-600/55"
            eyebrow="The Golden Boot race"
            icon={<Target className="w-4 h-4" />}
            rows={w.scorers.map((p) => ({
              key: p.code + p.name, code: p.code, label: p.name, display: String(p.stats.goals),
            }))}
          />
        ),
      });
    }

    if (w.assisters.length) {
      s.push({
        id: "playmaker",
        fx: "none",
        bg: "from-cyan-500 via-sky-600 to-blue-700",
        node: (
          <VideoLeadersSlide
            src="/creator.mp4"
            tint="from-cyan-500/60 via-sky-900/35 to-blue-700/55"
            eyebrow="The chief creator"
            icon={<Wand2 className="w-4 h-4" />}
            anim="pop"
            rows={w.assisters.map((p) => ({
              key: p.code + p.name, code: p.code, label: p.name, display: String(p.stats.assists),
            }))}
          />
        ),
      });
    }


    if (w.keepers.length) {
      s.push({
        id: "golden_glove",
        fx: "none",
        bg: "from-emerald-500 via-teal-600 to-cyan-700",
        node: (
          <VideoLeadersSlide
            src="/goldenglove.mp4"
            tint="from-emerald-500/60 via-teal-900/35 to-cyan-700/55"
            eyebrow="The Golden Glove"
            icon={<Shield className="w-4 h-4" />}
            anim="drop"
            rows={w.keepers.map((p) => ({
              key: p.code + p.name, code: p.code, label: p.name,
              display: `${p.stats.cleanSheets} CS · ${p.stats.saves} saves`,
            }))}
          />
        ),
      });
    }

    s.push({
      id: "wonderkids",
      fx: "none",
      bg: "from-lime-500 via-green-600 to-emerald-700",
      node: (
        <VideoLeadersSlide
          src="/wonderkids.mp4"
          tint="from-lime-500/60 via-green-900/35 to-emerald-700/55"
          eyebrow="Best young player"
          icon={<Rocket className="w-4 h-4" />}
          anim="pop"
          rows={[
            { key: "ESP-Cubarsi", code: "ESP", label: "Pau Cubarsí", display: "Young Player" },
          ]}
          footnote="Young Player Award — the tournament's finest under-21"
        />
      ),
    });

    if (wrapped.attack.length) {
      s.push({
        id: "goal_machines",
        fx: "none",
        bg: "from-rose-500 via-red-600 to-orange-600",
        node: (
          <GoalMachinesSlide
            headline={`${w.attack[0]?.name} turned every match into target practice.`}
            rows={w.attack.map((t) => ({
              key: t.code, code: t.code, label: t.name, display: `${t.gf} goals`,
            }))}
          />
        ),
      });
    }

    s.push({
      id: "goal_geography",
      fx: "net",
      bg: "from-sky-500 via-blue-600 to-indigo-700",
      node: (
        <SlideShell eyebrow="Where the goals came from" icon={<BarChart3 className="w-4 h-4" />}>
          {/* Goals by the scorers' club league */}
          <p className="text-white/70 text-[11px] font-black tracking-widest uppercase mb-2">
            By league
          </p>
          <div className="space-y-1.5 mb-5">
            {([
              ["Premier League", 61],
              ["La Liga", 42],
              ["Ligue 1", 22],
              ["Bundesliga", 21],
              ["Serie A", 17],
            ] as const).map(([name, goals]) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-white text-sm font-semibold w-28 sm:w-32 flex-shrink-0 truncate">
                  {name}
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-black/25 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white/85"
                    style={{ width: `${(goals / 61) * 100}%` }}
                  />
                </div>
                <span className="text-white font-black text-sm tabular-nums w-7 text-right">
                  {goals}
                </span>
              </div>
            ))}
          </div>

          {/* Top scoring clubs */}
          <p className="text-white/70 text-[11px] font-black tracking-widest uppercase mb-2">
            Top clubs
          </p>
          <div className="space-y-1.5 mb-5">
            {([
              ["Real Madrid", 22],
              ["Paris Saint-Germain", 16],
              ["Arsenal", 13],
            ] as const).map(([name, goals]) => (
              <div
                key={name}
                className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2"
              >
                <span className="text-white text-sm font-semibold flex-1 truncate">{name}</span>
                <span className="text-white font-black text-sm tabular-nums">{goals} goals</span>
              </div>
            ))}
          </div>

          {/* Set-piece goals */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/20 rounded-xl px-4 py-3">
              <div className="text-white font-black text-4xl leading-none tabular-nums">16</div>
              <div className="text-white/75 text-xs font-bold mt-1.5 tracking-wide uppercase">
                Penalty goals
              </div>
            </div>
            <div className="bg-black/20 rounded-xl px-4 py-3">
              <div className="text-white font-black text-4xl leading-none tabular-nums">7</div>
              <div className="text-white/75 text-xs font-bold mt-1.5 tracking-wide uppercase">
                Direct free-kick goals
              </div>
            </div>
          </div>
        </SlideShell>
      ),
    });

    s.push({
      id: "records",
      fx: "confetti",
      bg: "from-violet-700 via-fuchsia-800 to-slate-900",
      node: (
        <SlideShell eyebrow="The record book" icon={<Award className="w-4 h-4" />}>
          <p className="text-white/55 text-[11px] font-black tracking-widest uppercase mb-2">
            Player records
          </p>
          <div className="space-y-2 mb-4">
            <RecordStat code="POR" figure="6">
              <b>Ronaldo</b> — first ever to score in six different World Cups
            </RecordStat>
            <RecordStat code="FRA" figure="22">
              <b>Mbappé</b> — the World Cup&apos;s all-time top scorer
            </RecordStat>
            <RecordStat code="FRA" figure="7">
              <b>Olise</b> — most assists in a single World Cup
            </RecordStat>
            <RecordStat code="ARG" figure="7">
              <b>Messi</b> — scored in seven consecutive World Cup matches
            </RecordStat>
            <RecordStat code="MEX" figure="17y">
              <b>Gilberto Mora</b> — 2nd-youngest ever to start a knockout match
            </RecordStat>
          </div>

          <p className="text-white/55 text-[11px] font-black tracking-widest uppercase mb-2">
            Tournament records
          </p>
          <div className="space-y-2">
            <RecordStat figure="21">
              Most <b>comeback wins</b> in a single World Cup ever
            </RecordStat>
            <RecordStat code="FRA" code2="ENG" figure="10">
              <b>France 4–6 England</b> — most goals in any match, in a third-place playoff
            </RecordStat>
            <RecordStat code="BEL" figure="120'+5">
              <b>Tielemans</b> — latest game-winning goal in World Cup history
            </RecordStat>
            <RecordStat code="CUW" figure="156k">
              <b>Curaçao</b> — smallest nation by population ever to reach a World Cup
            </RecordStat>
            <RecordStat code="ARG" figure="3,000th">
              <b>Enzo Fernández</b> — scored the World Cup&apos;s 3,000th goal
            </RecordStat>
            <RecordStat code="JPN" code2="TUN" figure="1,000th">
              <b>Japan v Tunisia</b> — the 1,000th WC match, Jun 20
            </RecordStat>
          </div>
        </SlideShell>
      ),
    });

    const champion = data?.champion ?? null;
    s.push({
      id: "outro",
      fx: "confetti",
      bg: champion
        ? "from-yellow-400 via-amber-500 to-orange-600"
        : "from-blue-700 via-indigo-800 to-slate-900",
      node: champion ? (
        <ChampionSlide champion={champion} />
      ) : (
        <SlideShell eyebrow="To be continued" icon={<Trophy className="w-4 h-4" />}>
          <div>
            <div className="text-white font-black text-4xl sm:text-5xl leading-[1.05] tracking-tight mb-8">
              The story isn&apos;t
              <br />
              finished yet.
            </div>
            <BigNumber value={String(TOTAL_MATCHES - w.played)} label="Matches still to play" />
            <p className="text-white/70 text-sm font-semibold mt-8">
              Come back after the final for the full rewind.
            </p>
          </div>
        </SlideShell>
      ),
    });

    return s;
  }, [wrapped, data]);

  // ── Story navigation ──────────────────────────────────────────────────────
  const [idx, setIdx] = useState(0);
  const count = slides.length;

  const next = useCallback(
    () => setIdx((i) => (i + 1 < count ? i + 1 : i)),
    [count],
  );
  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);

  // Auto-advance; closes are manual. Restarts whenever the slide changes.
  useEffect(() => {
    if (idx >= count - 1) return; // hold on the last slide
    const t = setTimeout(next, slides[idx]?.ms ?? SLIDE_MS);
    return () => clearTimeout(t);
  }, [idx, count, next, slides]);

  // Lock scroll + keyboard controls.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, next, prev]);

  const slide = slides[idx];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Story card — square on desktop, full-bleed on mobile. Clicks inside the
          card stay inside; clicking the backdrop around it closes Wrapped. */}
      <div
        className="relative w-full h-full sm:w-[min(960px,92vmin)] sm:h-[min(960px,92vmin)] sm:rounded-3xl overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={`absolute inset-0 bg-gradient-to-br ${slide.bg}`}
          >
            {/* subtle texture */}
            <div className="absolute inset-0 opacity-25 [background:radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_15%_90%,rgba(0,0,0,0.35),transparent_50%)]" />
            <SlideFX variant={slide.fx} />
            <div className="relative h-full">{slide.node}</div>
          </motion.div>
        </AnimatePresence>

        {/* Progress segments */}
        <div className="absolute top-3 left-3 right-3 flex gap-1.5 z-20">
          {slides.map((s, i) => (
            <div key={s.id} className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
              {i < idx ? (
                <div className="h-full w-full bg-white" />
              ) : i === idx ? (
                <motion.div
                  key={`bar-${idx}`}
                  className="h-full bg-white"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: idx >= count - 1 ? 0.5 : (slide.ms ?? SLIDE_MS) / 1000, ease: "linear" }}
                />
              ) : null}
            </div>
          ))}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close wrapped"
          className="absolute top-6 right-4 z-30 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tap zones (story-style) */}
        <button aria-label="Previous slide" onClick={prev} className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-w-resize" />
        <button aria-label="Next slide" onClick={next} className="absolute inset-y-0 right-0 w-2/3 z-10 cursor-e-resize" />

        {/* Desktop arrows */}
        {idx > 0 && (
          <button
            onClick={prev}
            aria-label="Previous"
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/25 hover:bg-black/45 items-center justify-center text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {idx < count - 1 && (
          <button
            onClick={next}
            aria-label="Next"
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/25 hover:bg-black/45 items-center justify-center text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Slide counter */}
        <div className="absolute bottom-4 left-0 right-0 z-20 text-center text-white/60 text-[11px] font-bold tracking-widest">
          {idx + 1} / {count}
        </div>
      </div>
    </div>
  );
}
