import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Container from "@/components/layout/Container";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import BulkPricingButton from "@/components/BulkPricingButton";
import ProductCard from "@/components/ProductCard";
import { getProduct, getSimilarProducts } from "@/lib/api";
import { getProductGalleryUrls, slugify } from "@/lib/images";
import { productSchema } from "@/lib/seo";
import { COVERAGE_DISCLAIMER } from "@/lib/constants";
import type { ProductDetail, ProductSummary } from "@/lib/types";

export const revalidate = 600;

interface PageProps {
  params: Promise<{ id: string; slug?: string[] }>;
}

const SITE_NAME_FALLBACK = "Healix Medical Supply";

async function loadProduct(id: string): Promise<ProductDetail | null> {
  return getProduct(id);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProduct(id);
  if (!product) return {};

  const canonicalSlug = slugify(product.product_name);
  const title = `${product.product_name}${product.brand ? ` | ${product.brand}` : ""}`;

  return {
    title,
    description:
      product.description?.slice(0, 155) ||
      `Buy ${product.product_name} in bulk for healthcare facilities — ${SITE_NAME_FALLBACK}.`,
    alternates: { canonical: `/p/${product.product_id}/${canonicalSlug}` },
  };
}

const SPEC_LABELS: Record<string, string> = {
  size: "Size",
  color: "Color",
  unit_of_measure: "Unit of measure",
  quantity_per_unit: "Quantity per unit",
  material: "Material",
  upc: "UPC",
  pack_options: "Pack options",
  fda_class: "FDA class",
  certifications: "Certifications",
  age_group: "Age group",
  country_of_origin: "Country of origin",
  shelf_life_years: "Shelf life (years)",
  storage_temp: "Storage temperature",
  weight_lbs: "Weight (lbs)",
  dimensions_in: "Dimensions (in)",
};

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;
  const [product, similar] = await Promise.all([
    loadProduct(id),
    getSimilarProducts(id),
  ]);

  if (!product) notFound();

  const gallery = getProductGalleryUrls(product.category, product.product_id, product.subcategory, 4);
  const catSlug = slugify(product.category);
  const subSlug = product.subcategory ? slugify(product.subcategory) : null;

  const specs = Object.entries(SPEC_LABELS)
    .map(([key, label]) => [label, product[key]] as const)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");

  const booleanBadges = [
    product.latex_free && String(product.latex_free).toLowerCase().startsWith("y") ? "Latex-free" : null,
    product.sterile && String(product.sterile).toLowerCase().startsWith("y") ? "Sterile" : null,
  ].filter(Boolean) as string[];

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs
        crumbs={[
          { name: "Home", url: "/" },
          { name: product.category, url: `/c/${catSlug}` },
          ...(subSlug ? [{ name: product.subcategory, url: `/c/${catSlug}/${subSlug}` }] : []),
          { name: product.product_name, url: `/p/${product.product_id}` },
        ]}
      />

      <JsonLd
        schema={productSchema({
          id: product.product_id,
          name: product.product_name,
          brand: product.brand,
          description: product.description,
          image: gallery[0],
          priceEach: product.price_each,
          availability: product.availability,
          sku: product.sku,
          url: `/p/${product.product_id}`,
        })}
      />

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* ── Gallery ─────────────────────────────────────────────────── */}
        <div>
          <div className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-lg)] bg-mist">
            <Image
              src={gallery[0]}
              alt={product.product_name}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {gallery.slice(1).map((src) => (
              <div key={src} className="relative aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-mist">
                <Image src={src} alt="" fill sizes="25vw" className="object-cover" />
              </div>
            ))}
          </div>
        </div>

        {/* ── Details ─────────────────────────────────────────────────── */}
        <div>
          {product.brand && (
            <p className="text-caption font-semibold uppercase tracking-wide text-accent">
              {product.brand}
            </p>
          )}
          <h1 className="text-h1 mt-2 text-ink">{product.product_name}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-success-soft px-3 py-1 text-caption font-semibold text-success">
              {product.availability || "In Stock"}
            </span>
            {booleanBadges.map((badge) => (
              <span key={badge} className="rounded-full bg-accent-soft px-3 py-1 text-caption font-semibold text-accent">
                {badge}
              </span>
            ))}
            {product.sku && (
              <span className="text-caption text-ink-faint">SKU: {product.sku}</span>
            )}
          </div>

          {(product.price_each || product.price_case) && (
            <div className="mt-5 flex items-baseline gap-4">
              {product.price_each && (
                <p className="text-h2 text-ink">{product.price_each} <span className="text-small text-ink-faint">/ each</span></p>
              )}
              {product.price_case && (
                <p className="text-small text-ink-soft">{product.price_case} / case</p>
              )}
            </div>
          )}

          {product.description && (
            <p className="text-body mt-4 text-ink-soft">{product.description}</p>
          )}

          <div className="mt-6">
            <BulkPricingButton
              product={{ product_id: product.product_id, product_name: product.product_name, brand: product.brand }}
            />
          </div>

          {/* Coverage disclaimer — required placement #3: relevant product
              pages, right by the pricing CTA where a buyer would look for
              payment/coverage terms. */}
          <p className="mt-3 text-caption text-ink-faint">{COVERAGE_DISCLAIMER}</p>

          {specs.length > 0 && (
            <dl className="mt-8 divide-y divide-[var(--color-line-soft)] border-t border-line-soft text-small">
              {specs.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-ink-faint">{label}</dt>
                  <dd className="text-right text-ink">{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-16" aria-labelledby="similar-products">
          <h2 id="similar-products" className="text-h2 text-ink">
            Similar products
          </h2>
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {similar.map((p: ProductSummary) => (
              <li key={p.product_id}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
