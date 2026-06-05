"use client";

import { flagUrl } from "@/lib/flags";

/**
 * Renders a country flag as a small raster image from flagcdn.com.
 * Works on Windows Chrome (unlike emoji flags which render as letter pairs).
 */
export default function Flag({
  code,
  size = "md",
  className = "",
}: {
  code: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = { sm: "h-3.5 w-5", md: "h-4 w-6", lg: "h-5 w-8" } as const;
  const px = size === "sm" ? 20 : size === "lg" ? 80 : 40;

  return (
    <img
      src={flagUrl(code, px)}
      alt={code}
      className={`${dims[size]} object-cover rounded-[2px] flex-shrink-0 ${className}`}
      loading="lazy"
    />
  );
}
