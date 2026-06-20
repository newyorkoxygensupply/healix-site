"use client";

import { useCallback, useRef, useState } from "react";
import ProductCard from "./ProductCard";
import type { ProductFilters, ProductsResponse } from "@/lib/types";

interface Props {
  category: string;
  subcategory?: string | null;
  brands: string[];
  initial: ProductsResponse;
  /** Free-text query (set on /search; omitted on category PLPs) that must
   *  persist across every subsequent facet/sort/page request. */
  searchQuery?: string;
}

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "default", label: "Featured" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name: A–Z" },
];

/**
 * Instant, no-page-reload faceted filtering for the category PLP. SSR
 * delivers the first page (so it's crawlable and fast on first paint); every
 * filter/sort/pagination interaction after that is a same-origin client
 * fetch against /api/products (proxied to Flask) with no router navigation
 * and no full-page refresh. The URL bar is kept in sync via
 * history.replaceState purely for shareable/bookmarkable links — that call
 * never triggers a server round-trip itself.
 */
export default function FacetedProductGrid({ category, subcategory, brands, initial, searchQuery }: Props) {
  const [data, setData] = useState<ProductsResponse>(initial);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<ProductFilters>({
    q: searchQuery || undefined,
    category: category || undefined,
    subcategory: subcategory || undefined,
    page: 1,
    per_page: 24,
  });
  const requestId = useRef(0);

  const runFetch = useCallback(async (nextFilters: ProductFilters) => {
    const id = ++requestId.current;
    setLoading(true);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(nextFilters)) {
      if (value !== undefined && value !== "" && value !== null) {
        params.set(key, String(value));
      }
    }
    try {
      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error("Request failed");
      const json: ProductsResponse = await res.json();
      if (id !== requestId.current) return; // a newer request superseded this one
      setData(json);

      // Keep the URL shareable without a router navigation/reload.
      const url = new URL(window.location.href);
      url.search = params.toString();
      window.history.replaceState({}, "", url.toString());
    } catch {
      // Network/Flask hiccup — keep showing the last good result set rather
      // than blanking the grid.
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  function updateFilter(patch: Partial<ProductFilters>) {
    const next: ProductFilters = { ...filters, ...patch, page: 1 };
    setFilters(next);
    runFetch(next);
  }

  function goToPage(page: number) {
    const next: ProductFilters = { ...filters, page };
    setFilters(next);
    runFetch(next);
    document.getElementById("plp-grid-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div id="plp-grid-top" className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
      {/* ── Facet sidebar ───────────────────────────────────────────────── */}
      <aside aria-label="Filter products" className="space-y-6">
        {brands.length > 0 && (
          <FacetGroup label="Brand">
            <select
              value={filters.brand || ""}
              onChange={(e) => updateFilter({ brand: e.target.value || undefined })}
              className="w-full rounded-[var(--radius-sm)] border border-line bg-paper px-3 py-2 text-small text-ink"
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </FacetGroup>
        )}

        <FacetGroup label="Availability">
          <select
            value={filters.availability || ""}
            onChange={(e) => updateFilter({ availability: e.target.value || undefined })}
            className="w-full rounded-[var(--radius-sm)] border border-line bg-paper px-3 py-2 text-small text-ink"
          >
            <option value="">Any</option>
            <option value="In Stock">In Stock</option>
          </select>
        </FacetGroup>

        <FacetGroup label="Attributes">
          <label className="flex items-center gap-2 text-small text-ink-soft">
            <input
              type="checkbox"
              checked={filters.latex_free === "true"}
              onChange={(e) => updateFilter({ latex_free: e.target.checked ? "true" : undefined })}
              className="h-4 w-4 rounded border-line accent-[var(--color-accent)]"
            />
            Latex-free
          </label>
          <label className="mt-2 flex items-center gap-2 text-small text-ink-soft">
            <input
              type="checkbox"
              checked={filters.sterile === "true"}
              onChange={(e) => updateFilter({ sterile: e.target.checked ? "true" : undefined })}
              className="h-4 w-4 rounded border-line accent-[var(--color-accent)]"
            />
            Sterile
          </label>
        </FacetGroup>

        <FacetGroup label="Price">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              placeholder="Min"
              defaultValue={filters.min_price}
              onBlur={(e) => updateFilter({ min_price: e.target.value || undefined })}
              className="w-full rounded-[var(--radius-sm)] border border-line bg-paper px-2.5 py-2 text-small text-ink"
            />
            <span className="text-ink-faint">–</span>
            <input
              type="number"
              min={0}
              placeholder="Max"
              defaultValue={filters.max_price}
              onBlur={(e) => updateFilter({ max_price: e.target.value || undefined })}
              className="w-full rounded-[var(--radius-sm)] border border-line bg-paper px-2.5 py-2 text-small text-ink"
            />
          </div>
        </FacetGroup>
      </aside>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-small text-ink-soft" aria-live="polite">
            {data.total.toLocaleString()} products
          </p>
          <label className="flex items-center gap-2 text-small text-ink-soft">
            Sort
            <select
              value={filters.sort || "default"}
              onChange={(e) => updateFilter({ sort: e.target.value })}
              className="rounded-[var(--radius-sm)] border border-line bg-paper px-3 py-1.5 text-small text-ink"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>

        <ul
          aria-busy={loading}
          className={`mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 transition-opacity duration-150 ${loading ? "opacity-50" : "opacity-100"}`}
        >
          {data.products.map((p) => (
            <li key={p.product_id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>

        {data.products.length === 0 && (
          <p className="mt-10 text-center text-body text-ink-soft">
            No products match these filters. Try clearing a filter.
          </p>
        )}

        {data.total_pages > 1 && (
          <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => goToPage(data.page - 1)}
              className="rounded-full border border-line px-4 py-2 text-small font-medium text-ink disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-small text-ink-soft">
              Page {data.page} of {data.total_pages}
            </span>
            <button
              type="button"
              disabled={data.page >= data.total_pages}
              onClick={() => goToPage(data.page + 1)}
              className="rounded-full border border-line px-4 py-2 text-small font-medium text-ink disabled:opacity-40"
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-caption font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
