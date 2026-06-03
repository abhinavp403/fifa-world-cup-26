"use client";

// Makes the server-fetched squad map available to every client component
// via context, so they read the same Record<string, Squad> shape they used
// to import directly — just sourced from Supabase (or the static fallback).

import { createContext, useContext } from "react";
import type { Squad } from "@/lib/squads";

const SquadsContext = createContext<Record<string, Squad>>({});

export function SquadsProvider({
  value,
  children,
}: {
  value: Record<string, Squad>;
  children: React.ReactNode;
}) {
  return <SquadsContext.Provider value={value}>{children}</SquadsContext.Provider>;
}

/** Returns the squad map keyed by team code. */
export function useSquads(): Record<string, Squad> {
  return useContext(SquadsContext);
}
