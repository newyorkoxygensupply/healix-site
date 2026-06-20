import { jsonLd } from "@/lib/seo";

/** Drops a single JSON-LD <script> tag. One component, one schema object —
 *  compose multiple <JsonLd> per page rather than merging schemas, so each
 *  page only ships the entities it actually has data for. */
export default function JsonLd({ schema }: { schema: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
    />
  );
}
