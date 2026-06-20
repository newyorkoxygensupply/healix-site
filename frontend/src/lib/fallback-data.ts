import type { Meta } from "./types";

/**
 * Last-known-good catalog shape, baked into the build.
 *
 * Render's Flask service can cold-start (30–90s) after idle on lower tiers,
 * and any external dependency can have a bad minute. Rather than let that
 * take down navigation or the homepage, every live fetch in lib/api.ts falls
 * back to this snapshot so the shell always renders something correct and
 * navigable — never a blank page or a thrown 500.
 *
 * This is intentionally coarse (category names only, no subcategories,
 * rounded total) — it exists purely as a safety net, not a data source.
 */
export const FALLBACK_META: Meta = {
  total: 500000,
  categories: {
    Gloves: [],
    "Wound Care": [],
    Incontinence: [],
    "Diagnostic Equipment": [],
    "OR & Surgery": [],
    Respiratory: [],
    "IV & Vascular Access": [],
    "Orthopedic & Rehab": [],
    "Skin Care": [],
    PPE: [],
    "Patient Care": [],
    "Urology & Ostomy": [],
    "Lab Supplies": [],
    Nutrition: [],
    Textiles: [],
    "First Aid": [],
    Pharmacy: [],
    "Mobility & DME": [],
    Dental: [],
    Pediatric: [],
  },
  brands: [],
};
