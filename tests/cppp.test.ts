import { describe, expect, it } from "vitest";
import { extractDetailFields, parseCpppDate, parseCpppListing } from "@/lib/crawlers/cppp";

// Fixture mirrors the real eprocure.gov.in "latest active tenders" table:
// 7 columns, each row linking to a `tendersfullview` detail URL.
const FIXTURE = `
<table>
  <thead><tr>
    <th>Sl.No</th><th>e-Published Date</th><th>Bid Submission Closing Date</th>
    <th>Tender Opening Date</th><th>Title/Ref.No./Tender Id</th>
    <th>Organisation Name</th><th>Corrigendum</th>
  </tr></thead>
  <tbody>
    <tr>
      <td>1.</td>
      <td>11-Jul-2026 10:00 AM</td>
      <td>27-Jul-2026 06:00 PM</td>
      <td>29-Jul-2026 10:00 AM</td>
      <td><a href="https://eprocure.gov.in/cppp/tendersfullview/ABC123">REPAIR AND MAINT OF FIRE PUMP UNDER GE DEHU ROAD /8</a></td>
      <td>E-IN-C BRANCH - MILITARY ENGINEER SERVICES</td>
      <td>--</td>
    </tr>
    <tr>
      <td>2.</td>
      <td>11-Jul-2026 09:00 AM</td>
      <td>28-Jul-2026 03:00 PM</td>
      <td>30-Jul-2026 11:00 AM</td>
      <td><a href="https://eprocure.gov.in/cppp/tendersfullview/XYZ789">HWPM/PP/RESIN/26/01</a></td>
      <td>Heavy Water Board</td>
      <td>--</td>
    </tr>
  </tbody>
</table>`;

describe("parseCpppDate", () => {
  it("parses a dd-Mon-yyyy hh:mm AM/PM string", () => {
    const d = parseCpppDate("27-Jul-2026 06:00 PM");
    expect(d?.toISOString()).toBe("2026-07-27T18:00:00.000Z");
  });
  it("handles 12 AM/PM correctly", () => {
    expect(parseCpppDate("01-Jan-2026 12:00 AM")?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(parseCpppDate("01-Jan-2026 12:00 PM")?.toISOString()).toBe("2026-01-01T12:00:00.000Z");
  });
  it("returns null for garbage", () => {
    expect(parseCpppDate("not a date")).toBeNull();
  });
});

describe("parseCpppListing", () => {
  it("extracts real tenders from the listing HTML", () => {
    const rows = parseCpppListing(FIXTURE);
    expect(rows).toHaveLength(2);
    expect(rows[0].source).toBe("CPPP");
    expect(rows[0].sourceUrl).toBe("https://eprocure.gov.in/cppp/tendersfullview/ABC123");
    expect(rows[0].title).toContain("REPAIR AND MAINT OF FIRE PUMP");
    expect(rows[0].department).toBe("E-IN-C BRANCH - MILITARY ENGINEER SERVICES");
    expect(rows[0].submissionDate?.toISOString()).toBe("2026-07-27T18:00:00.000Z");
    expect(rows[1].department).toBe("Heavy Water Board");
  });

  it("ignores rows without a tendersfullview link", () => {
    const rows = parseCpppListing("<table><tr><td>x</td><td>y</td></tr></table>");
    expect(rows).toHaveLength(0);
  });

  it("dedupes repeated detail links", () => {
    const rows = parseCpppListing(FIXTURE + FIXTURE);
    expect(rows).toHaveLength(2);
  });
});

describe("extractDetailFields (detail-page enrichment)", () => {
  it("pulls tender value and EMD from rendered text (Indian number format)", () => {
    const f = extractDetailFields(
      "Basic Details Tender Value in ₹ 18,50,000 EMD Amount in ₹ 1,85,000 Tender Fee 0",
    );
    expect(f.estimatedValue).toBe(1850000);
    expect(f.emd).toBe(185000);
  });

  it("extracts a work-description requirement", () => {
    const f = extractDetailFields(
      "Work Item Details Work Description : Supply and installation of desktop computers for district offices. Tender Fee Details",
    );
    expect(f.requirements).toHaveLength(1);
    expect(f.requirements[0].requirement).toContain("Supply and installation of desktop");
    expect(f.requirements[0].mandatory).toBe(true);
  });

  it("returns nulls/empty when nothing matches", () => {
    const f = extractDetailFields("Home About Contact — no tender fields here");
    expect(f.estimatedValue).toBeNull();
    expect(f.emd).toBeNull();
    expect(f.requirements).toEqual([]);
  });
});
