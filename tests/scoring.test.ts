import { describe, expect, it } from "vitest";
import { keywordOverlapScore, scoreTender, tokenize } from "@/lib/scoring";

const baseCompany = {
  description:
    "IT services company specialising in web portal development, cloud migration and networking AMC for government departments. ISO 27001 certified.",
  annualTurnover: "60000000",
  gstNumber: "22AAAAA0000A1Z5",
  msmeNumber: "UDYAM-MH-00-0000000",
  employeeCount: 60,
};

const baseTender = {
  title: "Development and Maintenance of Citizen Services Web Portal",
  department: "National Informatics Centre",
  estimatedValue: "32000000",
  emd: "320000",
  requirements: [
    { requirement: "ISO 27001 certification", mandatory: true },
    { requirement: "Web portal experience", mandatory: true },
  ],
};

describe("tokenize", () => {
  it("drops stopwords and short tokens", () => {
    const tokens = tokenize("The supply of IT equipment for the department");
    expect(tokens.has("the")).toBe(false);
    expect(tokens.has("of")).toBe(false);
    expect(tokens.has("supply")).toBe(true);
    expect(tokens.has("equipment")).toBe(true);
  });
});

describe("keywordOverlapScore", () => {
  it("returns scores within 0-100", () => {
    const s = keywordOverlapScore("web portal cloud", "cloud migration web portal tender");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });

  it("scores related text higher than unrelated text", () => {
    const related = keywordOverlapScore(baseCompany.description, baseTender.title);
    const unrelated = keywordOverlapScore(
      "Catering services for canteens and food supply",
      baseTender.title,
    );
    expect(related).toBeGreaterThan(unrelated);
  });
});

describe("scoreTender", () => {
  it("gives a strong eligible company high eligibility", () => {
    const result = scoreTender(baseCompany, baseTender);
    expect(result.eligibilityScore).toBeGreaterThanOrEqual(80);
    expect(result.winProbability).toBeGreaterThan(0);
    expect(result.winProbability).toBeLessThanOrEqual(100);
  });

  it("penalises missing GST registration", () => {
    const withGst = scoreTender(baseCompany, baseTender);
    const withoutGst = scoreTender({ ...baseCompany, gstNumber: null }, baseTender);
    expect(withoutGst.eligibilityScore).toBeLessThan(withGst.eligibilityScore);
  });

  it("penalises insufficient turnover against the 30% convention", () => {
    const lowTurnover = scoreTender({ ...baseCompany, annualTurnover: "1000000" }, baseTender);
    const okTurnover = scoreTender(baseCompany, baseTender);
    expect(lowTurnover.eligibilityScore).toBeLessThan(okTurnover.eligibilityScore);
  });

  it("always returns reasons", () => {
    const result = scoreTender(baseCompany, baseTender);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("collapses win probability on a capability mismatch despite good compliance", () => {
    // A DevOps/AWS consultancy (fully registered) vs an RF-hardware
    // manufacturing tender: eligibility can stay high on paperwork, but the
    // win estimate must NOT — capability gates it.
    const devopsCo = {
      description: "DevOps and AWS cloud services and consultation.",
      annualTurnover: "50000000",
      gstNumber: "27AAAAA0000A1Z5",
      msmeNumber: null,
      employeeCount: 10,
    };
    const rfTender = {
      title: "Manufacturing and Supply of X-band Feed Components",
      department: "Electronics Corporation of India Limited",
      estimatedValue: null,
      emd: null,
      requirements: [{ requirement: "Waveguide fabrication capability", mandatory: true }],
    };
    const result = scoreTender(devopsCo, rfTender);
    expect(result.matchScore).toBeLessThan(35); // no capability overlap
    expect(result.winProbability).toBeLessThan(25); // must not overstate a hopeless bid
    // and a genuinely aligned bid should score far higher on win
    const good = scoreTender(baseCompany, baseTender);
    expect(good.winProbability).toBeGreaterThan(result.winProbability + 30);
  });
});
