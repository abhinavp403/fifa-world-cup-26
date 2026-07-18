"use client";

import { motion } from "framer-motion";
import { Swords, Trophy, Medal, Award } from "lucide-react";

import { BRACKET, THIRD_PLACE_MATCH, type Match, type Round, type Slot } from "@/lib/bracket";
import { TEAM_COLORS, type Team } from "@/lib/worldcup";
import Flag from "@/components/Flag";

// ─────────────────────────────────────────────────────────────────────────────
// A single match card — two slots stacked
// ─────────────────────────────────────────────────────────────────────────────

function SlotRow({ slot }: { slot: Slot }) {
  if (slot.team) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Flag code={slot.team.code} size="sm" />
        <span className="text-white text-sm font-semibold truncate flex-1">
          {slot.team.name}
        </span>
        <span className="text-gray-500 text-[10px] font-semibold tabular-nums">
          {slot.team.code}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="w-5 h-5 rounded-full border border-dashed border-[#214066] flex-shrink-0" />
      <span className="text-gray-400 text-xs font-medium tracking-wide truncate flex-1">
        {slot.label}
      </span>
      <span className="text-gray-700 text-[10px] font-semibold">TBD</span>
    </div>
  );
}

function MatchCard({
  match,
  highlight,
  onMatchClick,
}: {
  match: Match;
  highlight?: "final" | "third";
  onMatchClick?: (fixtureId: number | null, label: string, date: string) => void;
}) {
  const border =
    highlight === "final"
      ? "border-amber-400/40 shadow-[0_0_24px_-8px_rgba(251,191,36,0.45)]"
      : highlight === "third"
      ? "border-rose-400/30"
      : "border-[var(--border-card)] hover:border-[var(--accent-500)]/30";

  const label = `${match.slot1.team?.name ?? match.slot1.label} vs ${match.slot2.team?.name ?? match.slot2.label}`;
  const date = match.date ?? new Date(2026, 5, 11).toISOString();

  const inner = (
    <>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-card)] bg-[var(--bg-darker)]/40">
        <span className="text-[10px] font-bold tracking-widest text-gray-500">
          {match.id}
        </span>
        {match.venue ? (
          <span className="text-[10px] text-[var(--accent-300)]/80 truncate ml-2">
            {match.venue}
          </span>
        ) : (
          <span className="text-[10px] text-gray-600">TBD</span>
        )}
      </div>
      <SlotRow slot={match.slot1} />
      <div className="h-px bg-[var(--border-card)] mx-3" />
      <SlotRow slot={match.slot2} />
    </>
  );

  if (onMatchClick) {
    return (
      <button
        type="button"
        onClick={() => onMatchClick(match.fixtureId ?? null, label, date)}
        className={`w-full text-left bg-[var(--bg-card)]/80 backdrop-blur-sm border ${border} rounded-xl overflow-hidden transition-colors cursor-pointer group`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={`bg-[var(--bg-card)]/80 backdrop-blur-sm border ${border} rounded-xl overflow-hidden transition-colors`}
    >
      {inner}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Round column — vertically distributes its matches evenly so they line up
// with neighbouring rounds even as match counts halve each step.
// ─────────────────────────────────────────────────────────────────────────────

function RoundColumn({
  name,
  short,
  matches,
  index,
  totalRounds,
  thirdPlace,
  onMatchClick,
}: {
  name: string;
  short: string;
  matches: Match[];
  index: number;
  totalRounds: number;
  thirdPlace?: Match;
  onMatchClick?: (fixtureId: number | null, label: string, date: string) => void;
}) {
  const isFinal = index === totalRounds - 1;

  return (
    <div className="flex flex-col w-[220px] flex-shrink-0">
      <div className="text-center mb-3">
        <p className="text-[var(--accent-300)] text-[10px] font-bold tracking-widest">
          {short}
        </p>
        <p className="text-gray-500 text-[11px]">{name}</p>
      </div>

      <div
        className="flex-1 grid"
        style={{
          gridTemplateRows: `repeat(${matches.length}, minmax(0, 1fr))`,
          rowGap: "12px",
        }}
      >
        {matches.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35, delay: (i % 4) * 0.04 }}
            className="flex items-center"
          >
            <div className="w-full">
              <MatchCard
                match={m}
                highlight={isFinal ? "final" : undefined}
                onMatchClick={onMatchClick}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Third-place play-off sits below the final, as a real (clickable) match. */}
      {isFinal && thirdPlace && (
        <div className="mt-5">
          <p className="text-rose-300 text-[10px] font-bold tracking-widest text-center mb-2">
            3RD PLACE
          </p>
          <MatchCard match={thirdPlace} highlight="third" onMatchClick={onMatchClick} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main section
// ─────────────────────────────────────────────────────────────────────────────

export default function KnockoutBracket({
  rounds = BRACKET,
  thirdPlace = THIRD_PLACE_MATCH,
  champion = null,
  runnerUp = null,
  thirdPlaceWinner = null,
  onMatchClick,
}: {
  rounds?: Round[];
  thirdPlace?: Match;
  champion?: Team | null;
  runnerUp?: Team | null;
  thirdPlaceWinner?: Team | null;
  onMatchClick?: (fixtureId: number | null, label: string, date: string) => void;
} = {}) {
  return (
    <section id="bracket" className="px-4 py-10 scroll-mt-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Swords className="w-5 h-5 text-[var(--accent-400)]" />
          <h2 className="text-white font-bold text-2xl">Knockout Bracket</h2>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          32 teams · single-elimination to the final
        </p>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] mb-5">
          <Legend
            swatch={<span className="w-3 h-3 rounded-sm bg-amber-400/60" />}
            label="Final"
          />
          <Legend
            swatch={<span className="w-3 h-3 rounded-sm bg-rose-400/60" />}
            label="Third-place play-off"
          />
        </div>

        {/* Scrollable bracket */}
        <div className="relative">
          <div className="overflow-x-auto -mx-4 px-4 pb-4">
            <div className="bg-gradient-to-b from-[var(--bg-card)]/40 to-[var(--bg-darker)]/30 border border-[var(--border-card)] rounded-2xl p-5 min-w-[1180px]">
              <div className="flex gap-5 items-stretch min-h-[820px]">
                {rounds.map((round, i) => (
                  <RoundColumn
                    key={round.short}
                    name={round.name}
                    short={round.short}
                    matches={round.matches}
                    index={i}
                    totalRounds={rounds.length}
                    thirdPlace={i === rounds.length - 1 ? thirdPlace : undefined}
                    onMatchClick={onMatchClick}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Hint for mobile users */}
          <p className="text-gray-600 text-[11px] text-center mt-2 sm:hidden">
            Swipe horizontally to see all rounds →
          </p>
        </div>

        {/* Podium — populates as the final and third-place play-off are decided */}
        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          <PodiumBlock place="winner"    team={champion} />
          <PodiumBlock place="runnerUp"  team={runnerUp} />
          <PodiumBlock place="third"     team={thirdPlaceWinner} />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Podium — Winner / Runner-up / Third place
// ─────────────────────────────────────────────────────────────────────────────

const PODIUM_META = {
  winner: {
    label: "Winner",
    Icon: Trophy,
    accent: "#fbbf24", // amber-400
    ring: "border-amber-400/45",
    glow: "from-amber-400/15",
    text: "text-amber-200",
  },
  runnerUp: {
    label: "Runner-up",
    Icon: Medal,
    accent: "#cbd5e1", // slate-300 (silver)
    ring: "border-slate-300/35",
    glow: "from-slate-300/10",
    text: "text-slate-200",
  },
  third: {
    label: "Third place",
    Icon: Award,
    accent: "#f59e0b", // amber-500 (bronze-ish)
    ring: "border-orange-400/35",
    glow: "from-orange-400/10",
    text: "text-orange-200",
  },
} as const;

function PodiumBlock({
  place,
  team,
}: {
  place: keyof typeof PODIUM_META;
  team: Team | null;
}) {
  const m = PODIUM_META[place];
  const teamColor = team ? TEAM_COLORS[team.code] ?? m.accent : m.accent;

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${m.glow} to-transparent bg-[var(--bg-card)] border ${m.ring} rounded-2xl p-4 flex items-center gap-4`}
    >
      {/* medal icon badge */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border"
        style={{ backgroundColor: `${m.accent}1f`, borderColor: `${m.accent}55` }}
      >
        <m.Icon className="w-6 h-6" style={{ color: m.accent }} />
      </div>

      <div className="min-w-0 flex-1">
        <p className={`text-[10px] font-black tracking-widest uppercase ${m.text}`}>
          {m.label}
        </p>
        {team ? (
          <div className="flex items-center gap-2 mt-1">
            <Flag code={team.code} size="md" />
            <span className="text-white font-bold text-base truncate">{team.name}</span>
          </div>
        ) : (
          <p className="text-gray-500 text-sm font-semibold mt-1">To be decided</p>
        )}
      </div>

      {/* team-color accent bar */}
      {team && (
        <span
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: teamColor }}
        />
      )}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-gray-400">
      {swatch}
      <span>{label}</span>
    </div>
  );
}
