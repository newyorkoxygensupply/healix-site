import Link from "next/link";
import { getMeta } from "@/lib/api";
import Container from "./Container";
import MegaMenu from "./MegaMenu";

export default async function Header() {
  const { data: meta } = await getMeta();

  return (
    <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur-sm border-b border-line-soft">
      {/* Utility bar */}
      <div className="hidden md:block bg-ink text-white">
        <Container className="flex items-center justify-between py-2 text-caption">
          <p>B2B medical supply distributor &middot; {meta.total.toLocaleString()}+ products</p>
          <a href="tel:8885856510" className="font-medium hover:underline">
            (888) 585-6510
          </a>
        </Container>
      </div>

      {/* Main row */}
      <Container className="relative flex items-center gap-4 py-4">
        <Link href="/" className="text-h3 font-semibold tracking-tight text-ink shrink-0">
          Healix
        </Link>

        <MegaMenu categories={meta.categories} />

        <form
          role="search"
          action="/search"
          className="hidden md:flex flex-1 max-w-md ml-auto items-center gap-2 rounded-full border border-line bg-mist-2 px-4 py-2 focus-within:ring-2 focus-within:ring-accent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="text-ink-faint shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <label htmlFor="site-search" className="sr-only">
            Search 500,000+ medical supplies
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            placeholder="Search 500,000+ medical supplies…"
            className="flex-1 bg-transparent text-small outline-none placeholder:text-ink-faint"
          />
        </form>

        <Link
          href="/contact"
          className="hidden sm:inline-flex items-center rounded-full bg-accent px-4 py-2 text-small font-semibold text-accent-contrast hover:bg-accent-hover transition-colors duration-150"
        >
          Request Bulk Pricing
        </Link>
      </Container>
    </header>
  );
}
