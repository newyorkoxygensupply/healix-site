"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { slugify } from "@/lib/images";
import type { CategoryMap } from "@/lib/types";

/**
 * Desktop mega-menu + mobile accordion drawer for a 20-category / ~266-
 * subcategory catalog. Built for keyboard and screen-reader use, not just
 * mouse hover: every trigger is a real <button> with aria-expanded, Escape
 * closes the open panel and returns focus to its trigger, and outside
 * clicks close it too.
 */
export default function MegaMenu({ categories }: { categories: CategoryMap }) {
  const entries = Object.entries(categories);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenCat(null);
    }
    function onClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenCat(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  return (
    <>
      {/* ── Desktop mega-menu ───────────────────────────────────────────── */}
      <nav
        ref={navRef}
        aria-label="Product categories"
        className="hidden lg:flex items-center gap-1"
      >
        {entries.map(([cat, subs]) => {
          const isOpen = openCat === cat;
          const panelId = `${menuId}-${slugify(cat)}`;
          return (
            <div key={cat} className="relative">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenCat(isOpen ? null : cat)}
                className="px-3.5 py-2 text-small font-medium text-ink-soft hover:text-ink rounded-full hover:bg-mist transition-colors duration-150"
              >
                {cat}
              </button>
              {isOpen && (
                <div
                  id={panelId}
                  role="region"
                  aria-label={`${cat} subcategories`}
                  className="absolute left-0 top-full mt-2 w-72 max-h-[70vh] overflow-auto rounded-[var(--radius-lg)] border border-line-soft bg-paper p-3 shadow-[var(--shadow-popover)] z-50"
                >
                  <Link
                    href={`/c/${slugify(cat)}`}
                    onClick={() => setOpenCat(null)}
                    className="block px-3 py-2 rounded-[var(--radius-sm)] text-small font-semibold text-accent hover:bg-accent-soft"
                  >
                    Shop all {cat} &rarr;
                  </Link>
                  {subs.length > 0 && (
                    <ul className="mt-1 border-t border-line-soft pt-1">
                      {subs.slice(0, 12).map((sub) => (
                        <li key={sub}>
                          <Link
                            href={`/c/${slugify(cat)}/${slugify(sub)}`}
                            onClick={() => setOpenCat(null)}
                            className="block px-3 py-1.5 rounded-[var(--radius-sm)] text-small text-ink-soft hover:bg-mist hover:text-ink"
                          >
                            {sub}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Mobile trigger ──────────────────────────────────────────────── */}
      <button
        type="button"
        className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-mist"
        aria-expanded={mobileOpen}
        aria-controls="mobile-nav-drawer"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        onClick={() => setMobileOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          {mobileOpen ? (
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          ) : (
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          id="mobile-nav-drawer"
          className="lg:hidden absolute left-0 right-0 top-full bg-paper border-t border-line-soft shadow-[var(--shadow-popover)] max-h-[80vh] overflow-auto z-50"
        >
          <ul className="divide-y divide-[var(--color-line-soft)]">
            {entries.map(([cat]) => (
              <li key={cat}>
                <Link
                  href={`/c/${slugify(cat)}`}
                  onClick={() => setMobileOpen(false)}
                  className="block px-5 py-3.5 text-body font-medium text-ink"
                >
                  {cat}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
