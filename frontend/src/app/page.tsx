import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import Container from "@/components/layout/Container";
import { getMeta } from "@/lib/api";
import { getCategoryImageUrl, slugify } from "@/lib/images";

export const revalidate = 300; // ISR: re-fetch catalog stats every 5 minutes

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const VALUE_PROPS = [
  {
    title: "500,000+ SKUs",
    body: "The breadth of a national distributor, searchable in seconds.",
  },
  {
    title: "70+ trusted brands",
    body: "Clinical-grade gloves, wound care, diagnostics, and more.",
  },
  {
    title: "B2B bulk pricing",
    body: "Tell us your volume — we quote facility-level pricing directly.",
  },
  {
    title: "Dedicated support",
    body: "Call (888) 585-6510 and talk to a real procurement specialist.",
  },
];

export default async function HomePage() {
  const { data: meta } = await getMeta();
  const categories = Object.entries(meta.categories);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-mist">
        <Container className="py-20 sm:py-28 lg:py-32">
          <p className="text-caption font-semibold uppercase tracking-wide text-accent">
            Healix Medical Supply
          </p>
          <h1 className="text-display mt-3 max-w-3xl text-ink">
            Clinical-grade supply, at facility scale.
          </h1>
          <p className="text-body-lg mt-5 max-w-xl text-ink-soft">
            {meta.total.toLocaleString()}+ medical products across{" "}
            {categories.length} categories — sourced, stocked, and priced for
            healthcare facilities ordering in bulk.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/c/gloves"
              className="rounded-full bg-accent px-6 py-3 text-small font-semibold text-accent-contrast hover:bg-accent-hover transition-colors duration-150"
            >
              Browse the catalog
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-line bg-paper px-6 py-3 text-small font-semibold text-ink hover:bg-mist-2 transition-colors duration-150"
            >
              Request bulk pricing
            </Link>
          </div>
        </Container>
      </section>

      {/* ── Category grid ────────────────────────────────────────────────── */}
      <section aria-labelledby="shop-by-category">
        <Container className="py-16 sm:py-20">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="shop-by-category" className="text-h2 text-ink">
              Shop by category
            </h2>
            <Link href="/c" className="text-small font-semibold text-accent shrink-0">
              View all &rarr;
            </Link>
          </div>

          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map(([cat, subs], i) => {
              const slug = slugify(cat);
              return (
                <li key={cat}>
                  <Link
                    href={`/c/${slug}`}
                    className="surface-card group block overflow-hidden"
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-mist">
                      <Image
                        src={getCategoryImageUrl(cat, i)}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                        className="object-cover transition-transform duration-[var(--duration-slow)] group-hover:scale-105"
                      />
                    </div>
                    <div className="p-3.5">
                      <p className="text-small font-semibold text-ink">{cat}</p>
                      {subs.length > 0 && (
                        <p className="text-caption text-ink-faint mt-0.5">
                          {subs.length} subcategories
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* ── Value props ──────────────────────────────────────────────────── */}
      <section className="hairline bg-mist-2">
        <Container className="py-16 sm:py-20">
          <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_PROPS.map((vp) => (
              <li key={vp.title}>
                <p className="text-h3 text-ink">{vp.title}</p>
                <p className="text-small text-ink-soft mt-2">{vp.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </>
  );
}
