import { describe, expect, it } from "vitest";
import {
  canonicalCpppUrl,
  classifySource,
  detectMinEmployees,
  detectMsmeReserved,
  extractDetailFields,
  parseCpppDate,
  parseCpppListing,
} from "@/lib/crawlers/cppp";

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

describe("classifySource (portal-type label)", () => {
  it("labels PSUs", () => {
    expect(classifySource("NTPC Limited", "Supply of pumps")).toBe("PSU");
    expect(classifySource("Heavy Water Board", "Resin")).toBe("PSU");
  });
  it("labels state / municipal bodies", () => {
    expect(classifySource("Karnataka Public Works Department", "Road work")).toBe("StatePortal");
    expect(classifySource("Zilla Parishad Pune", "Anganwadi")).toBe("StatePortal");
  });
  it("does NOT label GeM (we don't crawl GeM) — falls through to CPPP", () => {
    expect(classifySource("Some Dept", "Procurement via GeM")).toBe("CPPP");
  });
  it("defaults to CPPP for central bodies", () => {
    expect(classifySource("Directorate of Printing", "Stationery rate contract")).toBe("CPPP");
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

describe("detectMsmeReserved", () => {
  it("flags an explicitly MSE/MSME-reserved tender", () => {
    expect(detectMsmeReserved("This tender is reserved for MSE bidders only.")).toBe(true);
    expect(detectMsmeReserved("Procurement reserved for Micro and Small Enterprises")).toBe(true);
  });
  it("returns null (unknown) when not stated", () => {
    expect(detectMsmeReserved("Open tender for supply of computers.")).toBeNull();
  });
});

describe("detectMinEmployees", () => {
  it("extracts a minimum manpower requirement", () => {
    expect(detectMinEmployees("Bidder must have minimum 15 technical personnel on rolls.")).toBe(15);
    expect(detectMinEmployees("at least 8 skilled staff required")).toBe(8);
  });
  it("returns null when no manpower requirement is present", () => {
    expect(detectMinEmployees("Supply and installation of desktops.")).toBeNull();
  });
});

describe("extractDetailFields (enrichment fields)", () => {
  it("includes msmeReserved and minEmployees", () => {
    const f = extractDetailFields(
      "Work Description : Facility management. Reserved for MSE. Bidder must have minimum 20 personnel.",
    );
    expect(f.msmeReserved).toBe(true);
    expect(f.minEmployees).toBe(20);
  });
});

describe("canonicalCpppUrl (stable dedup key)", () => {
  const base = "https://eprocure.gov.in/cppp/tendersfullview/MTM5NDIwNTM=";
  it("strips the rotating timestamp segment so the same tender dedupes", () => {
    const fetch1 = `${base}A13h1HASH1A13h1HASH2A13h1MTc4Mzk1NDk1Nw==A13h1REF`;
    const fetch2 = `${base}A13h1HASH1A13h1HASH2A13h1MTc4Mzk1NDk2Mg==A13h1REF`;
    expect(canonicalCpppUrl(fetch1)).toBe(base);
    expect(canonicalCpppUrl(fetch2)).toBe(base);
    expect(canonicalCpppUrl(fetch1)).toBe(canonicalCpppUrl(fetch2));
  });
  it("leaves a non-CPPP URL unchanged", () => {
    expect(canonicalCpppUrl("https://gem.gov.in/tenders/GEM-2026-X")).toBe(
      "https://gem.gov.in/tenders/GEM-2026-X",
    );
  });
});
