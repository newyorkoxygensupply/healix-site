import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, type Crumb } from "@/lib/seo";

/** Visual breadcrumb trail + matching BreadcrumbList JSON-LD, always built
 *  from the same crumb list so the two can never drift out of sync. */
export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <>
      <JsonLd schema={breadcrumbSchema(crumbs)} />
      <nav aria-label="Breadcrumb" className="text-caption text-ink-faint">
        <ol className="flex flex-wrap items-center gap-1.5">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <li key={crumb.url} className="flex items-center gap-1.5">
                {isLast ? (
                  <span aria-current="page" className="text-ink-soft">
                    {crumb.name}
                  </span>
                ) : (
                  <Link href={crumb.url} className="hover:text-ink hover:underline">
                    {crumb.name}
                  </Link>
                )}
                {!isLast && <span aria-hidden="true">/</span>}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
