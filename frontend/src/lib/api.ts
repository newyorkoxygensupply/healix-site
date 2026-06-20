import "server-only";
import type { CategoryContent, Meta, ProductDetail, ProductFilters, ProductsResponse, ProductSummary } from "./types";
import { FALLBACK_META } from "./fallback-data";

const API_BASE = process.env.FLASK_API_URL || "https://healixmedicalsupply.com";
const DEFAULT_TIMEOUT_MS = 8000;

class ApiError extends Error {
  constructor(public path: string, public status?: number, cause?: unknown) {
    super(`Healix API request failed: ${path}${status ? ` (${status})` : ""}`);
    this.cause = cause;
  }
}

/**
 * Server-side fetch against the Flask API with a hard timeout and Next.js
 * cache/revalidate wired in. Never throws past this boundary uncaught —
 * callers decide the fallback, but the network/timeout plumbing lives here
 * once so every data call gets the same resilience for free.
 */
async function apiFetch<T>(path: string, revalidateSeconds: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) throw new ApiError(path, res.status);
    return (await res.json()) as T;
  } catch (err) {
    throw new ApiError(path, undefined, err);
  } finally {
    clearTimeout(timeout);
  }
}

/** Catalog-wide metadata (totals, categories, brands). Falls back to a
 *  static snapshot rather than ever breaking navigation. */
export async function getMeta(): Promise<{ data: Meta; isFallback: boolean }> {
  try {
    const data = await apiFetch<Meta>("/api/meta", 300);
    return { data, isFallback: false };
  } catch {
    return { data: FALLBACK_META, isFallback: true };
  }
}

function buildQuery(filters: ProductFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "" && value !== null) {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

export async function getProducts(filters: ProductFilters = {}): Promise<ProductsResponse | null> {
  try {
    const qs = buildQuery(filters);
    return await apiFetch<ProductsResponse>(`/api/products${qs ? `?${qs}` : ""}`, 120);
  } catch {
    return null;
  }
}

export async function getProduct(productId: string): Promise<ProductDetail | null> {
  try {
    return await apiFetch<ProductDetail>(`/api/product/${encodeURIComponent(productId)}`, 600);
  } catch {
    return null;
  }
}

export async function getSimilarProducts(productId: string): Promise<ProductSummary[]> {
  try {
    return await apiFetch<ProductSummary[]>(`/api/similar/${encodeURIComponent(productId)}`, 600);
  } catch {
    return [];
  }
}

/** Editorial headline/intro/FAQ/related-categories content for a category
 *  PLP. Returns null on any failure (unknown slug, network hiccup) — the
 *  page renders fine without it, just without the FAQ section/schema. */
export async function getCategoryContent(catSlug: string): Promise<CategoryContent | null> {
  try {
    return await apiFetch<CategoryContent>(`/api/category-content/${encodeURIComponent(catSlug)}`, 3600);
  } catch {
    return null;
  }
}
