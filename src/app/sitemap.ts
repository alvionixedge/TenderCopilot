import type { MetadataRoute } from "next";

/** Public, indexable pages only — the app itself is behind auth. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.tendercopilot.in";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/free-check`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/signin`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/security`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/refunds`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
