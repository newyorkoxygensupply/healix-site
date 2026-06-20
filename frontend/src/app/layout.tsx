import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import JsonLd from "@/components/JsonLd";
import { organizationSchema, websiteSchema, SITE_NAME } from "@/lib/seo";
import "./globals.css";

// Deliberately using the native OS font stack (defined in globals.css)
// rather than next/font/google: it renders as true system UI type on every
// platform (SF Pro on Apple devices — exactly the "editorial/Apple" look
// the brief calls for), ships zero font bytes, and removes a build-time
// network dependency on fonts.googleapis.com entirely.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://healixmedicalsupply.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Clinical-Grade Medical Supplies, B2B`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Shop 500,000+ clinical-grade medical supplies — gloves, wound care, PPE, diagnostic equipment, and more from 70+ trusted brands. B2B pricing for healthcare facilities.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <JsonLd schema={organizationSchema()} />
        <JsonLd schema={websiteSchema()} />
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
