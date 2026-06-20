import Link from "next/link";
import Container from "@/components/layout/Container";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-caption font-semibold uppercase tracking-wide text-accent">
        404
      </p>
      <h1 className="text-h1 text-ink">We couldn&rsquo;t find that page</h1>
      <p className="text-body text-ink-soft max-w-md">
        It may have moved, or the link might be out of date. Try searching
        the catalog or head back to the homepage.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-accent px-5 py-2.5 text-small font-semibold text-accent-contrast hover:bg-accent-hover"
      >
        Back to home
      </Link>
    </Container>
  );
}
