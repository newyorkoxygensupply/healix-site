import type { NextConfig } from "next";

// The Flask/SQLite service (healixmedicalsupply.com) remains the system of
// record for the 500k-row catalog, search, AI chat, and inquiry pipeline.
// This Next.js app is the new editorial presentation layer (hybrid
// architecture) — it talks to that API server-side, and proxies the same
// paths same-origin for the browser so there is zero CORS surface.
const FLASK_API_URL = process.env.FLASK_API_URL || "https://healixmedicalsupply.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${FLASK_API_URL}/api/:path*` },

      // Sitemap/robots generation (segmented product batches, categories,
      // brands, blog, cities) is already fully implemented and battle-tested
      // on the Flask side (50k-row batches, correct lastmod dates, proper
      // cache headers) — every URL it lists uses the same slug scheme this
      // Next app uses, so there's nothing to gain from re-deriving it here.
      // Proxying keeps a single source of truth instead of two sitemap
      // systems that could silently drift apart.
      { source: "/robots.txt", destination: `${FLASK_API_URL}/robots.txt` },
      { source: "/sitemap.xml", destination: `${FLASK_API_URL}/sitemap.xml` },
      { source: "/sitemap-:rest.xml", destination: `${FLASK_API_URL}/sitemap-:rest.xml` },

      // Brand, blog, and city pages haven't been migrated to Next.js yet —
      // keep them served by Flask's existing templates so they don't 404
      // once this app becomes the public front door.
      { source: "/brand/:slug", destination: `${FLASK_API_URL}/brand/:slug` },
      { source: "/brands", destination: `${FLASK_API_URL}/brands` },
      { source: "/blog", destination: `${FLASK_API_URL}/blog` },
      { source: "/blog/:slug", destination: `${FLASK_API_URL}/blog/:slug` },
      { source: "/locations", destination: `${FLASK_API_URL}/locations` },
      { source: "/city/:slug", destination: `${FLASK_API_URL}/city/:slug` },
    ];
  },
  images: {
    // next/image optimizes these as local (same-origin) paths via the
    // rewrite above, so no remotePatterns entry is needed for the Flask
    // host itself. AVIF first, WebP fallback — both requested in the brief.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
