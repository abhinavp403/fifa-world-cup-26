"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Goal, Sparkles, ShieldCheck, Search, X, User } from "lucide-react";

import { GROUPS, TEAM_COLORS } from "@/lib/worldcup";
import { SQUADS, type SquadPlayer, type PlayerStats } from "@/lib/squads";

// ─────────────────────────────────────────────────────────────────────────────
// Types & helpers
// ─────────────────────────────────────────────────────────────────────────────

type PlayerWithTeam = {
  player:    SquadPlayer;
  teamCode:  string;
  teamName:  string;
  teamFlag:  string;
  teamColor: string;
};

const ALL_TEAMS = GROUPS.flatMap((g) => g.teams);

function getStat(p: SquadPlayer, key: keyof PlayerStats): number {
  return p.stats?.[key] ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Player avatar
// ─────────────────────────────────────────────────────────────────────────────

function PlayerAvatar({
  player,
  color,
  size = 36,
}: {
  player: SquadPlayer;
  color:  string;
  size?:  number;
}) {
  return (
    <div
      className="relative flex-shrink-0 rounded-full overflow-hidden"
      style={{ width: size, height: size }}
    >
      {player.photo ? (
        <Image
          src={player.photo}
          alt={player.name}
          fill
          sizes={`${size}px`}
          className="object-cover object-top"
          style={{ backgroundColor: color + "22" }}
          unoptimized
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-[11px] font-black text-white"
          style={{ backgroundColor: color + "55", border: `1px solid ${color}44` }}
        >
          {player.number}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LeaderCard — one of the three top-5 tables
// ─────────────────────────────────────────────────────────────────────────────

function LeaderCard({
  title,
  Icon,
  accent,
  statKey,
  players,
  filterFn,
  onPlayerClick,
}: {
  title:         string;
  Icon:          typeof Goal;
  accent:        string;
  statKey:       keyof PlayerStats;
  players:       PlayerWithTeam[];
  filterFn?:     (p: SquadPlayer) => boolean;
  onPlayerClick: (teamCode: string, number: number) => void;
}) {
  const top = useMemo(() => {
    const pool = filterFn ? players.filter((p) => filterFn(p.player)) : players;
    return [...pool]
      .sort((a, b) => {
        const diff = getStat(b.player, statKey) - getStat(a.player, statKey);
        if (diff !== 0) return diff;
        return a.player.name.localeCompare(b.player.name);
      })
      .slice(0, 5);
  }, [players, statKey, filterFn]);

  return (
    <div className="bg-[var(--bg-card)]/70 border border-[var(--border-card)] rounded-2xl overflow-hidden">
      <div
        className="px-4 py-3 border-b border-[var(--border-card)] flex items-center gap-2.5"
        style={{ background: `linear-gradient(to right, ${accent}11, transparent)` }}
      >
        <Icon className="w-4 h-4" style={{ color: accent }} />
        <h3 className="text-white font-bold text-sm tracking-tight">{title}</h3>
      </div>
      <div className="divide-y divide-[var(--border-row)]/60">
        {top.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-600 text-xs">No players yet.</p>
        ) : (
          top.map((p, i) => (
            <button
              type="button"
              key={`${p.teamCode}-${p.player.number}`}
              onClick={() => onPlayerClick(p.teamCode, p.player.number)}
              className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <span className="text-gray-600 text-[10px] font-black w-3 tabular-nums text-center">
                {i + 1}
              </span>
              <PlayerAvatar player={p.player} color={p.teamColor} size={34} />
              <div className="min-w-0 flex-1">
                <p className="text-white text-[13px] font-semibold truncate leading-tight">
                  {p.player.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm leading-none">{p.teamFlag}</span>
                  <span className="text-gray-600 text-[10px] truncate">{p.teamName}</span>
                </div>
              </div>
              <span
                className="font-black text-base tabular-nums flex-shrink-0"
                style={{ color: accent }}
              >
                {getStat(p.player, statKey)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchResultCard — shows one matched player with base stats
// ─────────────────────────────────────────────────────────────────────────────

function SearchResultCard({
  p,
  onClick,
}: {
  p:       PlayerWithTeam;
  onClick: () => void;
}) {
  const pos = p.player.position;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-[var(--bg-card)]/60 border border-[var(--border-card)] rounded-xl px-4 py-3 flex items-center gap-4 hover:border-[var(--border-strong)] hover:bg-[var(--bg-card)]/90 transition-colors cursor-pointer"
    >
      <PlayerAvatar player={p.player} color={p.teamColor} size={48} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-bold text-base truncate">{p.player.name}</span>
          {p.player.captain && (
            <span
              className="text-[8px] font-black px-1 py-0.5 rounded tracking-wider flex-shrink-0"
              style={{ color: p.teamColor, backgroundColor: p.teamColor + "22", border: `1px solid ${p.teamColor}44` }}
            >
              CAP
            </span>
          )}
          <span
            className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ color: p.teamColor, backgroundColor: p.teamColor + "22" }}
          >
            {pos}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 flex-wrap">
          <span className="text-sm leading-none">{p.teamFlag}</span>
          <span className="text-gray-400 font-semibold">{p.teamName}</span>
          <span className="text-gray-700">·</span>
          <span className="truncate">{p.player.club}</span>
          <span className="text-gray-700">·</span>
          <span>Age {p.player.age}</span>
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main section
// ─────────────────────────────────────────────────────────────────────────────

export default function PlayersSection({
  onPlayerClick,
}: {
  onPlayerClick: (teamCode: string, playerNumber: number) => void;
}) {
  const [search, setSearch] = useState("");

  const allPlayers = useMemo<PlayerWithTeam[]>(() => {
    const result: PlayerWithTeam[] = [];
    for (const [code, squad] of Object.entries(SQUADS)) {
      const team = ALL_TEAMS.find((t) => t.code === code);
      if (!team) continue;
      const teamColor = TEAM_COLORS[code] ?? "#3b82f6";
      for (const player of squad.players) {
        result.push({
          player,
          teamCode:  code,
          teamName:  team.name,
          teamFlag:  team.flag,
          teamColor,
        });
      }
    }
    return result;
  }, []);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length === 0) return [];
    return allPlayers
      .filter((p) => p.player.name.toLowerCase().includes(q))
      .sort((a, b) => a.player.name.localeCompare(b.player.name))
      .slice(0, 25);
  }, [search, allPlayers]);

  return (
    <section id="players" className="px-4 py-10 scroll-mt-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <User className="w-5 h-5 text-[var(--accent-400)]" />
          <h2 className="text-white font-bold text-2xl">Player Leaders</h2>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          Top performers across the tournament · auto-updates as matches are played
        </p>

        {/* ── 3 leader tables ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <LeaderCard
            title="Most Goals"
            Icon={Goal}
            accent="#4ade80"
            statKey="goals"
            players={allPlayers}
            onPlayerClick={onPlayerClick}
          />
          <LeaderCard
            title="Most Assists"
            Icon={Sparkles}
            accent="#60a5fa"
            statKey="assists"
            players={allPlayers}
            onPlayerClick={onPlayerClick}
          />
          <LeaderCard
            title="Most Clean Sheets"
            Icon={ShieldCheck}
            accent="#fbbf24"
            statKey="cleanSheets"
            players={allPlayers}
            filterFn={(p) => p.position === "GK"}
            onPlayerClick={onPlayerClick}
          />
        </div>

        {/* ── Search ── */}
        <div className="bg-[var(--bg-card)]/60 border border-[var(--border-card)] rounded-2xl p-5">
          <h3 className="text-white font-bold text-base mb-1">Player Search</h3>
          <p className="text-gray-500 text-xs mb-4">
            Search any World Cup player by name to see their base stats
          </p>

          <div className="relative max-w-md mb-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a player name…"
              className="w-full bg-[var(--bg-darker)] border border-[var(--border-card)] rounded-full pl-10 pr-9 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[var(--accent-500)]/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {search.trim().length > 0 && (
            <>
              {searchResults.length === 0 ? (
                <p className="text-gray-600 text-sm italic px-1">
                  No players match &quot;{search}&quot;.
                </p>
              ) : (
                <>
                  <p className="text-gray-600 text-[11px] tracking-wider uppercase font-bold mb-3">
                    {searchResults.length} {searchResults.length === 1 ? "result" : "results"}
                  </p>
                  <div className="space-y-2">
                    {searchResults.map((p) => (
                      <SearchResultCard
                        key={`${p.teamCode}-${p.player.number}`}
                        p={p}
                        onClick={() => onPlayerClick(p.teamCode, p.player.number)}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
