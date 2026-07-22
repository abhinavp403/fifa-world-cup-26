"use client";

// ⌘K command palette — instant, accent-insensitive search across all 48 teams
// and every squad player, plus quick actions (open Wrapped, jump to a section).
// Fully keyboard driven: ↑/↓ to move, Enter to run, Esc to close.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, Users, ArrowRight, CornerDownLeft } from "lucide-react";

import { GROUPS } from "@/lib/worldcup";
import { useSquads } from "@/lib/squadsContext";
import { normalizeText } from "@/lib/text";
import Flag from "@/components/Flag";

type Item =
  | { kind: "action"; id: string; label: string; hint?: string; run: () => void }
  | { kind: "team"; id: string; code: string; name: string; group: string; run: () => void }
  | {
      kind: "player";
      id: string;
      code: string;
      name: string;
      position: string;
      number: number;
      run: () => void;
    };

const ALL_TEAMS = GROUPS.flatMap((g) =>
  g.teams.map((t) => ({ code: t.code, name: t.name, group: g.letter })),
);

function jumpTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function CommandPalette({
  onClose,
  onTeam,
  onPlayer,
  onWrapped,
}: {
  onClose: () => void;
  onTeam: (code: string) => void;
  onPlayer: (code: string, number: number) => void;
  onWrapped: () => void;
}) {
  const squads = useSquads();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<Item[]>(() => {
    const q = normalizeText(query.trim());
    const out: Item[] = [];

    // Quick actions — always available, filtered by query.
    const actions: { id: string; label: string; hint?: string; run: () => void }[] = [
      { id: "wrapped", label: "Open Tournament Wrapped", hint: "story recap", run: onWrapped },
      { id: "groups", label: "Jump to Groups & Standings", run: () => jumpTo("groups") },
      { id: "bracket", label: "Jump to Knockout Bracket", run: () => jumpTo("bracket") },
      { id: "compare", label: "Jump to Team Comparison", run: () => jumpTo("analytics") },
      { id: "players", label: "Jump to Players", run: () => jumpTo("players") },
      { id: "cities", label: "Jump to Host Cities", run: () => jumpTo("cities") },
      { id: "top", label: "Back to top", run: () => jumpTo("overview") },
    ];
    actions.forEach((a) => {
      if (!q || normalizeText(a.label).includes(q)) out.push({ kind: "action", ...a });
    });

    // Teams — name or FIFA code.
    ALL_TEAMS.forEach((t) => {
      if (!q || normalizeText(t.name).includes(q) || normalizeText(t.code).includes(q)) {
        out.push({
          kind: "team",
          id: `team-${t.code}`,
          code: t.code,
          name: t.name,
          group: t.group,
          run: () => onTeam(t.code),
        });
      }
    });

    // Players — only once the query is meaningful (1200+ candidates).
    if (q.length >= 2) {
      for (const [code, squad] of Object.entries(squads)) {
        for (const p of squad.players) {
          if (normalizeText(p.name).includes(q)) {
            out.push({
              kind: "player",
              id: `player-${code}-${p.number}-${p.name}`,
              code,
              name: p.name,
              position: p.position,
              number: p.number,
              run: () => onPlayer(code, p.number),
            });
            if (out.length > 40) return out;
          }
        }
      }
    }

    return out;
  }, [query, squads, onTeam, onPlayer, onWrapped]);

  // Cap what we render; keep the cursor in range.
  const visible = useMemo(() => {
    const actions = items.filter((i) => i.kind === "action").slice(0, query ? 3 : 5);
    const teams = items.filter((i) => i.kind === "team").slice(0, query ? 6 : 4);
    const players = items.filter((i) => i.kind === "player").slice(0, 8);
    return [...actions, ...teams, ...players];
  }, [items, query]);

  // Focus, scroll lock, keyboard nav.
  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const run = (item: Item) => {
    onClose();
    // Let the palette unmount before scrolling/opening modals.
    setTimeout(item.run, 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Keep handled keys inside the palette — modals underneath also listen
    // for Escape on window and would close along with us otherwise.
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setCursor((c) => Math.max(0, Math.min(visible.length - 1, c + 1)));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setCursor((c) => Math.max(0, c - 1));
    }
    if (e.key === "Enter" && visible[cursor]) {
      e.preventDefault();
      e.stopPropagation();
      run(visible[cursor]);
    }
  };

  // Keep the highlighted row in view.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const sectionLabel = (kind: Item["kind"], idx: number) => {
    const first = visible.findIndex((i) => i.kind === kind);
    if (idx !== first) return null;
    const label = kind === "action" ? "Quick actions" : kind === "team" ? "Teams" : "Players";
    return (
      <div className="px-4 pt-3 pb-1.5 text-gray-500 text-[10px] font-black tracking-[0.2em] uppercase">
        {label}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center pt-[12vh] px-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: -14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 border-b border-[var(--border-card)]">
          <Search className="w-4 h-4 text-[var(--accent-400)] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={onKeyDown}
            placeholder="Search teams, players, or actions…"
            className="w-full bg-transparent text-white text-sm py-3.5 outline-none placeholder:text-gray-500"
          />
          <kbd className="hidden sm:block text-gray-500 text-[10px] font-bold border border-[var(--border-card)] rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[46vh] overflow-y-auto py-1.5">
          {visible.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No matches for &ldquo;{query}&rdquo;
            </div>
          )}
          {visible.map((item, idx) => (
            <div key={item.id}>
              {sectionLabel(item.kind, idx)}
              <button
                data-idx={idx}
                onClick={() => run(item)}
                onMouseEnter={() => setCursor(idx)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  idx === cursor ? "bg-[var(--accent-500)]/15" : ""
                }`}
              >
                {item.kind === "action" && (
                  <span className="w-6 h-6 rounded-md bg-[var(--accent-500)]/15 flex items-center justify-center text-[var(--accent-400)] flex-shrink-0">
                    {item.id === "wrapped" ? (
                      <Sparkles className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                  </span>
                )}
                {(item.kind === "team" || item.kind === "player") && (
                  <Flag code={item.code} size="md" />
                )}

                <span className="text-white text-sm font-semibold truncate flex-1">
                  {item.kind === "player" ? item.name : item.kind === "team" ? item.name : item.label}
                </span>

                {item.kind === "action" && item.hint && (
                  <span className="text-gray-500 text-xs">{item.hint}</span>
                )}
                {item.kind === "team" && (
                  <span className="text-gray-500 text-xs font-bold">Group {item.group}</span>
                )}
                {item.kind === "player" && (
                  <span className="text-gray-500 text-xs font-bold">
                    {item.code} · {item.position} · #{item.number}
                  </span>
                )}

                {idx === cursor && (
                  <CornerDownLeft className="w-3.5 h-3.5 text-[var(--accent-400)] flex-shrink-0" />
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[var(--border-card)] text-gray-500 text-[11px]">
          <span className="flex items-center gap-1.5">
            <Users className="w-3 h-3" /> {ALL_TEAMS.length} teams · 1,200+ players
          </span>
          <span className="ml-auto hidden sm:flex items-center gap-2">
            <kbd className="border border-[var(--border-card)] rounded px-1">↑↓</kbd> navigate
            <kbd className="border border-[var(--border-card)] rounded px-1">↵</kbd> open
          </span>
        </div>
      </motion.div>
    </div>
  );
}
