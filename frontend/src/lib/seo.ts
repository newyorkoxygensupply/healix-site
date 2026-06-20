/** JSON-LD builders. Kept as plain functions returning serializable objects
 *  so every page can compose exactly the entities it needs (a category page
 *  doesn't need Product schema, a product page doesn't need CollectionPage,
 *  etc.) rather than one bloated sitewide schema graph. */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://healixmedicalsupply.com";
export const SITE_NAME = "Healix Medical Supply";

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    telephone: "+1-888-585-6510",
    description:
      "B2B medical supply distributor serving healthcare facilities with clinical-grade gloves, wound care, PPE, diagnostic equipment, and more.",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+1-888-585-6510",
      contactType: "sales",
      areaServed: "US",
    },
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export interface Crumb {
  name: string;
  url: string;
}

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.url}`,
    })),
  };
}

interface ProductSchemaInput {
  id: string;
  name: string;
  brand: string;
  description?: string;
  image?: string;
  priceEach?: string;
  availability: string;
  sku?: string;
  url: string;
}

export function productSchema(p: ProductSchemaInput) {
  const price = (p.priceEach || "").replace(/[^0-9.]/g, "");
  const availabilityMap: Record<string, string> = {
    "In Stock": "https://schema.org/InStock",
    Limited: "https://schema.org/LimitedAvailability",
    Backorder: "https://schema.org/BackOrder",
  };
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku,
    brand: { "@type": "Brand", name: p.brand },
    description: p.description,
    image: p.image ? [`${SITE_URL}${p.image}`] : undefined,
    url: `${SITE_URL}${p.url}`,
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: price || undefined,
      availability: availabilityMap[p.availability] || "https://schema.org/InStock",
      url: `${SITE_URL}${p.url}`,
      // B2B distributor: pricing requires an account / bulk inquiry, not a
      // cart checkout — flagged so rich-result eligibility stays honest.
      businessFunction: "http://purl.org/goodrelations/v1#Sell",
    },
  };
}

export interface FAQItem {
  question: string;
  answer: string;
}

export function faqSchema(items: FAQItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** Renders a <script type="application/ld+json"> safely (escapes `</script>`
 *  so a product description can never break out of the script tag). */
export function jsonLd(schema: unknown): string {
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}
