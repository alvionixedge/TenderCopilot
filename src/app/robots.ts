import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Auth-gated app surfaces and APIs — nothing indexable there.
        disallow: [
          "/api/",
          "/dashboard",
          "/tenders",
          "/proposals",
          "/pipeline",
          "/company",
          "/billing",
          "/settings",
          "/admin",
        ],
      },
    ],
    sitemap: "https://www.tendercopilot.in/sitemap.xml",
  };
}
