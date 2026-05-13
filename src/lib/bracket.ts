// FIFA World Cup 2026 — knockout bracket
// 48-team format: 32 advance to R32 (top 2 from each group + 8 best thirds)
//
// Slot labels follow the FIFA convention:
//   "1A"   = winner of Group A
//   "2B"   = runner-up of Group B
//   "3 ABEF" = best 3rd-placed team from one of those groups
//
// Each slot has a `team` field that's `null` until results land — drop the
// real Team object in there to replace the proxy text.

import type { Team } from "@/lib/worldcup";

export type Slot = {
  label: string;       // proxy text e.g. "1A"
  team: Team | null;   // populated post-group-stage
};

export type Match = {
  id: string;          // e.g. "M73"
  date?: string;       // ISO — optional, filled when scheduled
  venue?: string;
  slot1: Slot;
  slot2: Slot;
};

export type Round = {
  name: string;
  short: string;
  matches: Match[];
};

// ──────────────────────────────────────────────────────────────────────────
// Proxy bracket. The 16 R32 pairings below follow FIFA's published 2026
// knockout path. The remaining rounds resolve as "Winner of M73" etc.
// ──────────────────────────────────────────────────────────────────────────

const r32: Match[] = [
  { id: "M73", slot1: { label: "1A",        team: null }, slot2: { label: "2B",        team: null } },
  { id: "M74", slot1: { label: "1C",        team: null }, slot2: { label: "3 D/E/F",   team: null } },
  { id: "M75", slot1: { label: "1E",        team: null }, slot2: { label: "2D",        team: null } },
  { id: "M76", slot1: { label: "1B",        team: null }, slot2: { label: "3 A/E/F",   team: null } },
  { id: "M77", slot1: { label: "1G",        team: null }, slot2: { label: "3 A/B/D",   team: null } },
  { id: "M78", slot1: { label: "1F",        team: null }, slot2: { label: "2H",        team: null } },
  { id: "M79", slot1: { label: "1D",        team: null }, slot2: { label: "2F",        team: null } },
  { id: "M80", slot1: { label: "1H",        team: null }, slot2: { label: "2G",        team: null } },
  { id: "M81", slot1: { label: "1I",        team: null }, slot2: { label: "3 C/D/E",   team: null } },
  { id: "M82", slot1: { label: "1K",        team: null }, slot2: { label: "2L",        team: null } },
  { id: "M83", slot1: { label: "1J",        team: null }, slot2: { label: "2I",        team: null } },
  { id: "M84", slot1: { label: "1L",        team: null }, slot2: { label: "3 B/H/J/K", team: null } },
  { id: "M85", slot1: { label: "2J",        team: null }, slot2: { label: "3 C/G/H/L", team: null } },
  { id: "M86", slot1: { label: "2K",        team: null }, slot2: { label: "3 B/G/I/L", team: null } },
  { id: "M87", slot1: { label: "2A",        team: null }, slot2: { label: "3 G/H/I/K", team: null } },
  { id: "M88", slot1: { label: "2C",        team: null }, slot2: { label: "2E",        team: null } },
];

// Helpers to chain proxy labels forward
const W = (id: string) => ({ label: `W ${id}`, team: null as Team | null });

const r16: Match[] = [
  { id: "M89",  slot1: W("M73"), slot2: W("M74") },
  { id: "M90",  slot1: W("M75"), slot2: W("M76") },
  { id: "M91",  slot1: W("M77"), slot2: W("M78") },
  { id: "M92",  slot1: W("M79"), slot2: W("M80") },
  { id: "M93",  slot1: W("M81"), slot2: W("M82") },
  { id: "M94",  slot1: W("M83"), slot2: W("M84") },
  { id: "M95",  slot1: W("M85"), slot2: W("M86") },
  { id: "M96",  slot1: W("M87"), slot2: W("M88") },
];

const qf: Match[] = [
  { id: "M97",  slot1: W("M89"), slot2: W("M90") },
  { id: "M98",  slot1: W("M91"), slot2: W("M92") },
  { id: "M99",  slot1: W("M93"), slot2: W("M94") },
  { id: "M100", slot1: W("M95"), slot2: W("M96") },
];

const sf: Match[] = [
  { id: "M101", slot1: W("M97"), slot2: W("M98") },
  { id: "M102", slot1: W("M99"), slot2: W("M100") },
];

const final: Match[] = [
  {
    id: "M104",
    date: "2026-07-19T19:00:00Z",
    venue: "MetLife Stadium · New Jersey",
    slot1: W("M101"),
    slot2: W("M102"),
  },
];

export const BRACKET: Round[] = [
  { name: "Round of 32", short: "R32",   matches: r32 },
  { name: "Round of 16", short: "R16",   matches: r16 },
  { name: "Quarter-finals", short: "QF", matches: qf },
  { name: "Semi-finals", short: "SF",    matches: sf },
  { name: "Final",       short: "FINAL", matches: final },
];

export const THIRD_PLACE_MATCH: Match = {
  id: "M103",
  date: "2026-07-18T19:00:00Z",
  venue: "Hard Rock Stadium · Miami",
  slot1: { label: "L M101", team: null },
  slot2: { label: "L M102", team: null },
};
