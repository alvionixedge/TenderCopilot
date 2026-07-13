import { describe, expect, it } from "vitest";
import {
  RELEVANCE_THRESHOLD,
  employeesEligible,
  fitsProfile,
  msmeEligible,
  tenderRelevance,
  turnoverEligible,
} from "@/lib/tender-filter";
import { missingRequiredProfileFields } from "@/lib/company-profile";

const itCompany = {
  description:
    "IT services company: web portal development, cloud migration, networking AMC for government departments.",
  annualTurnover: "60000000",
};

describe("tenderRelevance", () => {
  it("scores an on-domain tender above an off-domain one", () => {
    const onDomain = tenderRelevance(itCompany, {
      title: "Development and Maintenance of Citizen Services Web Portal",
      department: "National Informatics Centre",
      estimatedValue: null,
    });
    const offDomain = tenderRelevance(itCompany, {
      title: "Supply of Rock Phosphate in bulk",
      department: "Fertilisers and Chemicals Travancore Ltd",
      estimatedValue: null,
    });
    expect(onDomain).toBeGreaterThan(offDomain);
  });
});

describe("turnoverEligible", () => {
  it("passes when turnover clears ~30% of value", () => {
    expect(turnoverEligible("60000000", "100000000")).toBe(true); // 60M >= 30M
  });
  it("fails when turnover is well short of 30% of value", () => {
    expect(turnoverEligible("5000000", "100000000")).toBe(false); // 5M < 30M
  });
  it("passes (can't assess) when the tender value is unknown", () => {
    expect(turnoverEligible("5000000", null)).toBe(true);
  });
  it("passes when turnover is unknown", () => {
    expect(turnoverEligible(null, "100000000")).toBe(true);
  });
});

describe("fitsProfile", () => {
  it("keeps an on-domain, affordable tender", () => {
    expect(
      fitsProfile(itCompany, {
        title: "Cloud migration and web portal AMC for department",
        department: "National Informatics Centre",
        estimatedValue: "20000000",
      }),
    ).toBe(true);
  });
  it("drops an off-domain tender even if affordable", () => {
    expect(
      fitsProfile(itCompany, {
        title: "Supply of Rock Phosphate in bulk",
        department: "Fertilisers and Chemicals Travancore Ltd",
        estimatedValue: "1000000",
      }),
    ).toBe(false);
  });
  it("drops an on-domain tender the turnover can't support", () => {
    expect(
      fitsProfile({ ...itCompany, annualTurnover: "2000000" }, {
        title: "Cloud migration and web portal development",
        department: "National Informatics Centre",
        estimatedValue: "500000000", // needs 150M turnover
      }),
    ).toBe(false);
  });
  it("RELEVANCE_THRESHOLD is a sane 0-100 bound", () => {
    expect(RELEVANCE_THRESHOLD).toBeGreaterThan(0);
    expect(RELEVANCE_THRESHOLD).toBeLessThan(100);
  });
});

describe("missingRequiredProfileFields", () => {
  it("lists all four when there is no company", () => {
    expect(missingRequiredProfileFields(null)).toHaveLength(4);
  });
  it("flags the specific missing fields", () => {
    const m = missingRequiredProfileFields({
      companyName: "Acme",
      gstNumber: null,
      annualTurnover: "0",
      description: "We build web portals for government.",
    });
    expect(m).toContain("GSTIN");
    expect(m).toContain("Annual turnover");
    expect(m).not.toContain("Company name");
    expect(m).not.toContain("Capability statement");
  });
  it("returns empty when the profile is complete", () => {
    expect(
      missingRequiredProfileFields({
        companyName: "Acme Infotech",
        gstNumber: "22AAAAA0000A1Z5",
        annualTurnover: "25000000",
        description: "IT services company for government departments.",
      }),
    ).toEqual([]);
  });
});

describe("msmeEligible", () => {
  it("blocks a non-MSME company from an MSME-reserved tender", () => {
    expect(msmeEligible(null, true)).toBe(false);
    expect(msmeEligible("", true)).toBe(false);
  });
  it("allows an MSME company into an MSME-reserved tender", () => {
    expect(msmeEligible("UDYAM-MH-00-0000000", true)).toBe(true);
  });
  it("passes when reservation is unknown or not reserved", () => {
    expect(msmeEligible(null, null)).toBe(true);
    expect(msmeEligible(null, false)).toBe(true);
  });
});

describe("employeesEligible", () => {
  it("blocks a company below the tender's minimum manpower", () => {
    expect(employeesEligible(5, 20)).toBe(false);
  });
  it("allows a company that meets the minimum", () => {
    expect(employeesEligible(25, 20)).toBe(true);
  });
  it("passes when either side is unknown", () => {
    expect(employeesEligible(null, 20)).toBe(true);
    expect(employeesEligible(5, null)).toBe(true);
  });
});
