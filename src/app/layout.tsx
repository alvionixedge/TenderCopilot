import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TenderCopilot AI — Procurement & Bid Management",
    template: "%s · TenderCopilot AI",
  },
  description:
    "AI-powered procurement and bid management. Discover matching government tenders, score eligibility, generate compliant proposals, and track bids to win.",
  icons: { icon: "/brand/mark.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
