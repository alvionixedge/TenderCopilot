import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://www.tendercopilot.in";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TenderCopilot AI — Win Indian Government Tenders | CPPP, State & PSU",
    template: "%s · TenderCopilot AI",
  },
  description:
    "AI tender management for Indian government procurement. Live CPPP, state and PSU tenders matched to your company, instant eligibility scoring, and compliance-ready proposals in minutes. Built for Indian SMBs, MSMEs and bid consultants.",
  keywords: [
    "government tenders India",
    "CPPP tenders",
    "eprocure tenders",
    "tender management software India",
    "AI tender software",
    "bid management India",
    "PSU tenders",
    "state government tenders",
    "MSME tenders",
    "tender eligibility check",
    "AI proposal generator",
    "e-procurement India",
  ],
  // Each page is its own canonical (resolved against metadataBase).
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "TenderCopilot AI",
    title: "TenderCopilot AI — Win Indian Government Tenders",
    description:
      "Live CPPP, state and PSU tenders matched to your company. Instant eligibility scoring and AI-drafted, compliance-ready proposals — built for India.",
    images: [{ url: "/brand/logo.png", width: 1200, height: 320, alt: "TenderCopilot AI" }],
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "TenderCopilot AI — Win Indian Government Tenders",
    description:
      "Live CPPP, state and PSU tenders matched to your company. Instant eligibility scoring and AI proposals — built for India.",
    images: ["/brand/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: { icon: "/brand/mark.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
