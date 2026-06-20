import type { Metadata } from "next";
import Container from "@/components/layout/Container";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import InquiryForm from "@/components/InquiryForm";
import { COVERAGE_DISCLAIMER, PHONE_DISPLAY, PHONE_TEL, CONTACT_EMAIL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Request Bulk Pricing",
  description:
    "Tell us your volume and we'll quote facility-level pricing directly. Healix serves healthcare facilities nationwide with 500,000+ clinical-grade medical supplies.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumbs crumbs={[{ name: "Home", url: "/" }, { name: "Contact", url: "/contact" }]} />

      <div className="mt-6 grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="text-h1 text-ink">Request bulk pricing</h1>
          <p className="text-body-lg mt-4 max-w-lg text-ink-soft">
            Healix prices by facility volume, not list price. Share what
            you&rsquo;re ordering and a procurement specialist will follow up
            directly — usually within one business day.
          </p>

          {/* Coverage disclaimer — required placement #2: this inquiry flow
              is the closest thing this B2B catalog has to a "checkout". */}
          <div className="mt-6 rounded-[var(--radius-md)] border border-line bg-mist px-5 py-4 text-small text-ink-soft">
            <strong className="text-ink">Coverage notice:</strong>{" "}
            {COVERAGE_DISCLAIMER}
          </div>

          <dl className="mt-10 space-y-4 text-small">
            <div>
              <dt className="font-semibold text-ink">Call sales</dt>
              <dd>
                <a href={`tel:${PHONE_TEL}`} className="text-accent font-semibold">
                  {PHONE_DISPLAY}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Email</dt>
              <dd>
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent font-semibold">
                  {CONTACT_EMAIL}
                </a>
              </dd>
            </div>
          </dl>
        </div>

        <div className="surface-card p-6 sm:p-8">
          <InquiryForm />
        </div>
      </div>
    </Container>
  );
}
