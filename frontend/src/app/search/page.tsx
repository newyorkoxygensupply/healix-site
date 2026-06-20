import type { Metadata } from "next";
import Container from "@/components/layout/Container";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import FacetedProductGrid from "@/components/FacetedProductGrid";
import { getMeta, getProducts } from "@/lib/api";

export const revalidate = 0; // search results are query-driven, never cached as a static page

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Search results for "${q}"` : "Search",
    // Search-result pages are intentionally not indexed: the content is a
    // dynamic slice of the catalog with no stable canonical URL per query,
    // and the category PLPs already cover that content with real canonicals.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = (q || "").trim();

  const [{ data: meta }, products] = await Promise.all([
    getMeta(),
    query ? getProducts({ q: query, page: 1, per_page: 24 }) : Promise.resolve(null),
  ]);

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs crumbs={[{ name: "Home", url: "/" }, { name: "Search", url: "/search" }]} />

      <h1 className="text-h1 mt-4 text-ink">
        {query ? <>Results for &ldquo;{query}&rdquo;</> : "Search"}
      </h1>

      {!query && (
        <p className="text-body mt-2 max-w-2xl text-ink-soft">
          Use the search bar above to find products across our 500,000+ SKU catalog.
        </p>
      )}

      {query && (
        <p className="text-body-lg mt-2 max-w-2xl text-ink-soft">
          {(products?.total ?? 0).toLocaleString()} products found.
        </p>
      )}

      {query && products && (
        <FacetedProductGrid category="" subcategory={null} brands={meta.brands} initial={products} searchQuery={query} />
      )}

      {query && !products && (
        <p className="mt-10 text-body text-ink-soft">
          We couldn&rsquo;t load search results right now. Please refresh, or call{" "}
          <a href="tel:8885856510" className="font-semibold text-accent">(888) 585-6510</a>.
        </p>
      )}
    </Container>
  );
}
