/** Shapes returned by the existing Flask API (app.py) — the system of
 *  record for the 500,000-row catalog. Kept intentionally close to the raw
 *  JSON so the frontend never silently drifts from what the backend ships. */

export type CategoryMap = Record<string, string[]>; // category -> subcategories

export interface Meta {
  total: number;
  categories: CategoryMap;
  brands: string[];
}

export interface ProductSummary {
  product_id: string;
  product_name: string;
  brand: string;
  category: string;
  subcategory: string;
  sku: string;
  price_each: string;
  price_case: string;
  availability: string;
  image_url_1: string;
  size: string;
  color: string;
  unit_of_measure: string;
  quantity_per_unit: string;
  latex_free: string;
  sterile: string;
  url: string;
}

export interface ProductsResponse {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  products: ProductSummary[];
}

/** /api/product/<id> returns the full SQLite row plus a couple of computed
 *  fields — looser typing here since column presence varies by import batch. */
export interface ProductDetail extends ProductSummary {
  description?: string;
  features?: string;
  material?: string;
  upc?: string;
  pack_options?: string;
  fda_class?: string;
  certifications?: string;
  age_group?: string;
  country_of_origin?: string;
  shelf_life_years?: string | number;
  storage_temp?: string;
  weight_lbs?: string | number;
  dimensions_in?: string;
  image_url_2?: string;
  image_url_3?: string;
  image_url_4?: string;
  [key: string]: unknown;
}

/** /api/category-content/<slug> — editorial copy + FAQ that already exists
 *  on the Flask side (CAT_SEO/CAT_RELATED), exposed as JSON so the Next.js
 *  category PLP can ship real FAQPage schema instead of inventing content. */
export interface CategoryContent {
  category: string;
  headline: string;
  intro: string;
  keywords: string[];
  /** Flask serializes its (question, answer) tuples as 2-element arrays. */
  faq: [string, string][];
  related: string[];
}

export interface ProductFilters {
  q?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  availability?: string;
  latex_free?: string;
  sterile?: string;
  min_price?: string;
  max_price?: string;
  sort?: string;
  page?: number;
  per_page?: number;
}
