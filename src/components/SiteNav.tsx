"use client";

import { useEffect, useRef, useState } from "react";
import {
  Trophy,
  LayoutDashboard,
  Users,
  MapPin,
  BarChart3,
  Swords,
} from "lucide-react";

const NAV_LINKS = [
  { label: "Overview",   href: "#overview",  icon: LayoutDashboard },
  { label: "Groups",     href: "#groups",    icon: Users },
  { label: "Bracket",    href: "#bracket",   icon: Swords },
  { label: "Host Cities", href: "#cities",   icon: MapPin },
  { label: "Analytics",  href: "#analytics", icon: BarChart3 },
];

export default function SiteNav() {
  const [active, setActive] = useState<string>("#overview");
  const [progress, setProgress] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Scroll progress bar
  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(maxScroll > 0 ? scrolled / maxScroll : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Active section via IntersectionObserver
  useEffect(() => {
    const visible = new Map<string, number>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.boundingClientRect.top);
          } else {
            visible.delete(entry.target.id);
          }
        });
        if (visible.size === 0) return;
        const topmost = [...visible.entries()].sort((a, b) => a[1] - b[1])[0][0];
        setActive(`#${topmost}`);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 },
    );

    NAV_LINKS.forEach(({ href }) => {
      const el = document.querySelector(href);
      if (el) observerRef.current!.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const el = document.querySelector(href);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 24;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <>
      {/* Scroll progress bar — pinned to left edge, vertical */}
      <div className="fixed top-0 left-0 bottom-0 z-[60] w-[2px] pointer-events-none hidden lg:block">
        <div
          className="w-full bg-gradient-to-b from-blue-600 via-cyan-300 to-emerald-400"
          style={{ height: `${progress * 100}%` }}
        />
      </div>

      {/* Mobile/tablet — thin top progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-[2px] pointer-events-none lg:hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-600 via-cyan-300 to-emerald-400"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="fixed left-4 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col gap-3 pointer-events-none">
        {/* Brand */}
        <a
          href="#overview"
          onClick={(e) => scrollTo(e, "#overview")}
          className="flex items-center gap-3 bg-[#071e38]/70 backdrop-blur-md border border-[#0f2d4a] rounded-2xl px-3 py-3 pointer-events-auto hover:border-blue-500/40 transition-colors"
        >
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/30 to-emerald-500/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-4 h-4 text-blue-200" />
          </span>
          <div className="pr-1">
            <p className="text-white font-bold text-sm leading-none tracking-tight">
              WC<span className="text-blue-400">26</span>
            </p>
            <p className="text-gray-500 text-[10px] mt-1 tracking-widest uppercase">
              Dashboard
            </p>
          </div>
        </a>

        {/* Links */}
        <nav className="flex flex-col gap-1 bg-[#071e38]/70 backdrop-blur-md border border-[#0f2d4a] rounded-2xl p-2 pointer-events-auto">
          {NAV_LINKS.map(({ label, href, icon: Icon }) => {
            const isActive = active === href;
            return (
              <a
                key={href}
                href={href}
                onClick={(e) => scrollTo(e, href)}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${
                  isActive
                    ? "bg-blue-500/15 text-white"
                    : "text-gray-400 hover:text-white hover:bg-[#0f2d4a]"
                }`}
              >
                {/* Active indicator bar */}
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all ${
                    isActive ? "h-6 bg-blue-400" : "h-0 bg-transparent"
                  }`}
                />
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isActive ? "text-blue-300" : "text-gray-500 group-hover:text-gray-300"
                  }`}
                />
                <span className="text-sm font-semibold whitespace-nowrap pr-2">
                  {label}
                </span>
              </a>
            );
          })}
        </nav>

        {/* Footer pill — kickoff date */}
        <div className="flex items-center gap-2 bg-[#071e38]/70 backdrop-blur-md border border-[#0f2d4a] rounded-2xl px-3 py-2.5 pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <div>
            <p className="text-gray-300 text-xs font-semibold leading-none">
              Jun 11, 2026
            </p>
            <p className="text-gray-600 text-[10px] mt-1">Kickoff</p>
          </div>
        </div>
      </aside>

      {/* ── Mobile / tablet — bottom-left floating rail ──────────────────── */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 lg:hidden">
        <div className="flex items-center gap-1 bg-[#071e38]/80 backdrop-blur-md border border-[#0f2d4a] rounded-full px-2 py-1.5 shadow-lg shadow-black/40">
          {NAV_LINKS.map(({ label, href, icon: Icon }) => {
            const isActive = active === href;
            return (
              <a
                key={href}
                href={href}
                onClick={(e) => scrollTo(e, href)}
                aria-label={label}
                className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                  isActive
                    ? "bg-blue-500/20 border border-blue-500/40 text-blue-200"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
              </a>
            );
          })}
        </div>
      </nav>
    </>
  );
}
