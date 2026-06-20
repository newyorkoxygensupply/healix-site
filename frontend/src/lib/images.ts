/**
 * Product imagery helpers — ported from the live static/js/app.js logic so
 * the new frontend reuses the exact same 278-bucket (category, subcategory)
 * Pexels photo scheme already deployed on the Flask side, instead of
 * re-introducing the old 20-bucket "every product in a category looks the
 * same" problem in a new codebase.
 *
 * URLs are same-origin relative paths (e.g. /api/photo/gloves/exam-gloves/0)
 * so next/image can optimize them through the rewrite in next.config.ts —
 * no remote CORS, no separate allow-list of the Flask host.
 */

// Must stay byte-for-byte in sync with CAT_SLUG in static/js/app.js — this is
// the contract between frontend bucket keys and the backend's photo route.
export const CAT_SLUG: Record<string, string> = {
  Gloves: "gloves",
  "Wound Care": "wound-care",
  Incontinence: "incontinence",
  "Diagnostic Equipment": "diagnostic",
  "OR & Surgery": "or-surgery",
  Respiratory: "respiratory",
  "IV & Vascular Access": "iv",
  "Orthopedic & Rehab": "orthopedic",
  "Skin Care": "skin-care",
  PPE: "ppe",
  "Patient Care": "patient-care",
  "Urology & Ostomy": "ostomy",
  "Lab Supplies": "lab",
  Nutrition: "nutrition",
  Textiles: "textiles",
  "First Aid": "first-aid",
  Pharmacy: "pharmacy",
  "Mobility & DME": "mobility",
  Dental: "dental",
  Pediatric: "pediatric",
};

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Resolves a URL slug back to the real category name from `/api/meta`.
 *  IMPORTANT: this must use the same generic `slugify()` as Flask's
 *  `/c/<cat_slug>` route — never CAT_SLUG, which is only an image-bucket
 *  key and diverges from the URL slug for several categories (e.g.
 *  "Diagnostic Equipment" -> CAT_SLUG "diagnostic" but URL slug
 *  "diagnostic-equipment"). Routing and canonical URLs must stay on one
 *  slug scheme; CAT_SLUG stays scoped to /api/photo bucket keys only. */
export function resolveCategory(
  categories: Record<string, string[]>,
  slug: string,
): string | null {
  return Object.keys(categories).find((c) => slugify(c) === slug) ?? null;
}

/** Resolves a subcategory slug within a known category's subcategory list. */
export function resolveSubcategory(
  subcategories: string[],
  slug: string,
): string | null {
  return subcategories.find((s) => slugify(s) === slug) ?? null;
}

export function subcatSlug(subcategory?: string | null): string {
  return subcategory ? slugify(subcategory) : "_";
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Per-product photo, bucketed by category + subcategory (the fix that
 *  replaced the old 20-category/160-photo pool with ~266 targeted pools). */
export function getProductImageUrl(
  category: string,
  productId: string,
  subcategory?: string | null,
): string {
  const slug = CAT_SLUG[category] || "patient-care";
  const sub = subcatSlug(subcategory);
  const n = hashCode(productId || "") % 8;
  return `/api/photo/${slug}/${sub}/${n}`;
}

/** PDP gallery: several distinct photos from the same (category,
 *  subcategory) bucket pool, since the raw CSV image_url_1..4 columns are
 *  unreliable placeholder data — the deployed /api/photo bucket scheme is
 *  the one credible, verified-live image source on this site. */
export function getProductGalleryUrls(
  category: string,
  productId: string,
  subcategory?: string | null,
  count = 4,
): string[] {
  const slug = CAT_SLUG[category] || "patient-care";
  const sub = subcatSlug(subcategory);
  const base = hashCode(productId || "") % 8;
  return Array.from({ length: count }, (_, i) => `/api/photo/${slug}/${sub}/${(base + i) % 8}`);
}

/** Category-level photo (subcategory wildcard) — used for nav/category
 *  tiles where there's no single product to bucket against. */
export function getCategoryImageUrl(category: string, seed = 0): string {
  const slug = CAT_SLUG[category] || "patient-care";
  return `/api/photo/${slug}/_/${seed % 8}`;
}

/** Inline-SVG icon fallback if both the Pexels bucket and the proxy fail —
 *  same last-resort tier as the existing imgFallback() chain in app.js. */
export function getCategoryIconUrl(category: string): string {
  const slug = CAT_SLUG[category] || "patient-care";
  return `/api/catimg/${slug}/0`;
}
