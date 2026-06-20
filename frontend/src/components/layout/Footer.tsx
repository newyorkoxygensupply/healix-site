import Link from "next/link";
import Container from "./Container";
import { slugify } from "@/lib/images";
import { COVERAGE_DISCLAIMER, PHONE_DISPLAY, PHONE_TEL } from "@/lib/constants";

const SHOP_CATEGORIES = [
  "Gloves",
  "Wound Care",
  "PPE",
  "Diagnostic Equipment",
  "Mobility & DME",
];

const COMPANY_LINKS: ReadonlyArray<readonly [string, string]> = [
  ["About Healix", "/about"],
  ["Blog", "/blog"],
  ["Locations Served", "/locations"],
  ["Contact", "/contact"],
];

const SUPPORT_LINKS: ReadonlyArray<readonly [string, string]> = [
  ["Request Bulk Pricing", "/contact"],
  ["Shipping & Fulfillment", "/shipping"],
  ["Returns", "/returns"],
  ["Privacy Policy", "/privacy"],
  ["Terms of Service", "/terms"],
];

export default function Footer() {
  // Routing slugs must match Flask's generic slugify(category) — never the
  // CAT_SLUG image-bucket map, which diverges for several category names.
  const shopLinks = SHOP_CATEGORIES.map(
    (cat) => [cat, `/c/${slugify(cat)}`] as const,
  );

  return (
    <footer className="mt-24 bg-mist">
      {/* Coverage disclaimer — required placement #1: footer, sitewide. */}
      <Container className="pt-10">
        <div className="rounded-[var(--radius-md)] border border-line bg-paper px-5 py-4 text-small text-ink-soft">
          <strong className="text-ink">Coverage notice:</strong>{" "}
          {COVERAGE_DISCLAIMER}
        </div>
      </Container>

      <Container className="grid grid-cols-2 gap-10 py-14 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <p className="text-h3 font-semibold text-ink">Healix</p>
          <p className="mt-3 text-small text-ink-soft max-w-xs">
            Clinical-grade medical supplies for healthcare facilities,
            nationwide. 500,000+ SKUs, 70+ trusted brands.
          </p>
          <a
            href={`tel:${PHONE_TEL}`}
            className="mt-3 inline-block text-small font-semibold text-accent"
          >
            {PHONE_DISPLAY}
          </a>
        </div>

        <FooterColumn title="Shop" links={shopLinks} />
        <FooterColumn title="Company" links={COMPANY_LINKS} />
        <FooterColumn title="Support" links={SUPPORT_LINKS} />
      </Container>

      <Container className="hairline flex flex-col gap-2 py-6 text-caption text-ink-faint sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Healix Medical Supply. All rights reserved.</p>
        <p>{COVERAGE_DISCLAIMER}</p>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <div>
      <p className="text-caption font-semibold uppercase tracking-wide text-ink-faint">{title}</p>
      <ul className="mt-3 space-y-2.5">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-small text-ink-soft hover:text-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
