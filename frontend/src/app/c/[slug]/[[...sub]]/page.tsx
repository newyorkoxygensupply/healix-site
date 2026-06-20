import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Container from "@/components/layout/Container";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import FacetedProductGrid from "@/components/FacetedProductGrid";
import { getCategoryContent, getMeta, getProducts } from "@/lib/api";
import { resolveCategory, resolveSubcategory, slugify } from "@/lib/images";
import { faqSchema } from "@/lib/seo";

export const revalidate = 120;

interface PageProps {
  params: Promise<{ slug: string; sub?: string[] }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug, sub } = await params;
  const { page } = await searchParams;
  const { data: meta } = await getMeta();
  const category = resolveCategory(meta.categories, slug);
  if (!category) return {};

  const subSlug = sub?.[0];
  const subcategory = subSlug ? resolveSubcategory(meta.categories[category] || [], subSlug) : null;

  const title = subcategory ? `${subcategory} | ${category}` : `${category} Medical Supplies`;
  const basePath = subcategory ? `/c/${slug}/${subSlug}` : `/c/${slug}`;
  const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);
  // Canonical strips every facet param (brand/price/availability/sort) —
  // those never get their own indexable URL — but keeps `page`, since
  // paginated results are genuinely distinct content, not duplicates.
  const canonical = pageNum > 1 ? `${basePath}?page=${pageNum}` : basePath;

  return {
    title,
    description: subcategory
      ? `Shop ${subcategory} products in the ${category} category. Bulk B2B pricing for healthcare facilities.`
      : `Shop ${category} medical supplies. Bulk B2B pricing for healthcare facilities — clinical-grade quality, fast fulfillment.`,
    alternates: { canonical },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug, sub } = await params;
  const { page } = await searchParams;
  const { data: meta } = await getMeta();
  const category = resolveCategory(meta.categories, slug);
  if (!category) notFound();

  const subcategories = meta.categories[category] || [];
  const subSlug = sub?.[0];
  const subcategory = subSlug ? resolveSubcategory(subcategories, subSlug) : null;
  if (subSlug && !subcategory) notFound();

  const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);
  const catSlug = slugify(category);

  // The editorial intro/FAQ content only exists at the top-level category
  // (Flask's CAT_SEO is keyed by category name, not subcategory), and only
  // makes sense to show on page 1 — it's not pagination-specific content.
  const [products, content] = await Promise.all([
    getProducts({ category, subcategory: subcategory || undefined, page: pageNum, per_page: 24 }),
    !subcategory && pageNum === 1 ? getCategoryContent(catSlug) : Promise.resolve(null),
  ]);

  const basePath = subcategory ? `/c/${catSlug}/${subSlug}` : `/c/${catSlug}`;

  return (
    <Container className="py-10 sm:py-14">
      {/* Pagination SEO: explicit rel=prev/next link tags. Next.js 13+
          hoists native <link> elements rendered anywhere in the tree up
          into <head> automatically. */}
      {products && pageNum > 1 && (
        <link rel="prev" href={pageNum === 2 ? basePath : `${basePath}?page=${pageNum - 1}`} />
      )}
      {products && pageNum < products.total_pages && (
        <link rel="next" href={`${basePath}?page=${pageNum + 1}`} />
      )}

      <Breadcrumbs
        crumbs={[
          { name: "Home", url: "/" },
          { name: category, url: `/c/${catSlug}` },
          ...(subcategory ? [{ name: subcategory, url: `/c/${catSlug}/${subSlug}` }] : []),
        ]}
      />

      <h1 className="text-h1 mt-4 text-ink">{content?.headline || subcategory || category}</h1>
      <p className="text-body-lg mt-2 max-w-2xl text-ink-soft">
        {(products?.total ?? 0).toLocaleString()} products
        {subcategory ? ` in ${subcategory}` : ` across ${category}`} — bulk B2B
        pricing for healthcare facilities.
      </p>

      {content?.intro && (
        <p className="text-body mt-4 max-w-3xl text-ink-soft">{content.intro}</p>
      )}

      {!subcategory && subcategories.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {subcategories.map((s) => (
            <li key={s}>
              <Link
                href={`/c/${catSlug}/${slugify(s)}`}
                className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-small text-ink-soft hover:border-accent hover:text-accent"
              >
                {s}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {products ? (
        <FacetedProductGrid
          category={category}
          subcategory={subcategory}
          brands={meta.brands}
          initial={products}
        />
      ) : (
        <p className="mt-10 text-body text-ink-soft">
          We couldn&rsquo;t load products right now. Please refresh, or call{" "}
          <a href="tel:8885856510" className="font-semibold text-accent">(888) 585-6510</a>.
        </p>
      )}

      {content && content.faq.length > 0 && (
        <section className="mt-16 max-w-3xl" aria-labelledby="category-faq">
          <JsonLd
            schema={faqSchema(content.faq.map(([question, answer]) => ({ question, answer })))}
          />
          <h2 id="category-faq" className="text-h2 text-ink">Frequently asked questions</h2>
          <dl className="mt-6 divide-y divide-[var(--color-line-soft)] border-t border-line-soft">
            {content.faq.map(([question, answer]) => (
              <div key={question} className="py-5">
                <dt className="text-body font-semibold text-ink">{question}</dt>
                <dd className="mt-2 text-body text-ink-soft">{answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {content && content.related.length > 0 && (
        <section className="mt-12" aria-labelledby="related-categories">
          <h2 id="related-categories" className="text-h3 text-ink">Related categories</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {content.related.map((rel) => (
              <li key={rel}>
                <Link
                  href={`/c/${slugify(rel)}`}
                  className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-small text-ink-soft hover:border-accent hover:text-accent"
                >
                  {rel}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
