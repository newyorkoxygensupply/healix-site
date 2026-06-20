"use client";

import { useEffect } from "react";
import Link from "next/link";
import Container from "@/components/layout/Container";

/** Route-segment error boundary. Catches render/data errors below the root
 *  layout (so the header/footer chrome stays intact) and gives the visitor
 *  a real recovery path instead of a blank screen. */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error boundary:", error);
  }, [error]);

  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-h2 text-ink">Something didn&rsquo;t load correctly</p>
      <p className="text-body text-ink-soft max-w-md">
        This is on us, not you. Try again, or call us directly and we&rsquo;ll
        help with your order.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-accent px-5 py-2.5 text-small font-semibold text-accent-contrast hover:bg-accent-hover"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-line px-5 py-2.5 text-small font-semibold text-ink hover:bg-mist"
        >
          Back to home
        </Link>
        <a
          href="tel:8885856510"
          className="text-small font-semibold text-accent"
        >
          (888) 585-6510
        </a>
      </div>
    </Container>
  );
}
