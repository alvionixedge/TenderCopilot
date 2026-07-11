import { describe, expect, it } from "vitest";
import { feedItemSchema } from "@/lib/tender-feed";

describe("feedItemSchema (live tender feed mapping)", () => {
  it("maps a full provider item to a NormalizedTender", () => {
    const parsed = feedItemSchema.safeParse({
      source: "GeM",
      sourceUrl: "https://gem.gov.in/tenders/REAL-123",
      title: "Supply of laptops",
      department: "Dept of IT",
      estimatedValue: 1850000,
      emd: 18500,
      submissionDate: "2026-09-01T00:00:00Z",
      requirements: [{ requirement: "ISO 9001", mandatory: true, category: "Compliance" }],
    });
    expect(parsed.success).toBe(true);
    const t = parsed.success ? parsed.data : null;
    expect(t?.source).toBe("GeM");
    expect(t?.title).toBe("Supply of laptops");
    expect(t?.submissionDate?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(t?.requirements[0].requirement).toBe("ISO 9001");
  });

  it("accepts `url` as an alias for sourceUrl and defaults source", () => {
    const parsed = feedItemSchema.safeParse({
      url: "https://eprocure.gov.in/tenders/X",
      title: "AMC contract",
    });
    expect(parsed.success).toBe(true);
    const t = parsed.success ? parsed.data : null;
    expect(t?.sourceUrl).toBe("https://eprocure.gov.in/tenders/X");
    expect(t?.source).toBe("External");
    expect(t?.requirements).toEqual([]);
  });

  it("converts daysToDeadline into an absolute submissionDate", () => {
    const parsed = feedItemSchema.safeParse({
      sourceUrl: "https://x.gov.in/t/1",
      title: "T",
      daysToDeadline: 10,
    });
    const t = parsed.success ? parsed.data : null;
    expect(t?.submissionDate).toBeInstanceOf(Date);
    expect(t!.submissionDate!.getTime()).toBeGreaterThan(Date.now());
  });

  it("yields null (skipped) when no URL is present", () => {
    const parsed = feedItemSchema.safeParse({ title: "no url" });
    // schema succeeds but transform returns null -> ingestion skips it
    expect(parsed.success && parsed.data === null).toBe(true);
  });

  it("rejects an item with no title", () => {
    const parsed = feedItemSchema.safeParse({ sourceUrl: "https://x.gov.in/t/2" });
    expect(parsed.success).toBe(false);
  });

  it("defaults requirement.mandatory to true when omitted", () => {
    const parsed = feedItemSchema.safeParse({
      sourceUrl: "https://x.gov.in/t/3",
      title: "T",
      requirements: [{ requirement: "GST registration" }],
    });
    const t = parsed.success ? parsed.data : null;
    expect(t?.requirements[0].mandatory).toBe(true);
  });
});
