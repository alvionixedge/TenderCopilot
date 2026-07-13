import { describe, expect, it } from "vitest";
import { parseAiScore } from "@/lib/ai-scoring";

describe("parseAiScore", () => {
  it("parses a clean JSON object", () => {
    const r = parseAiScore('{"match":15,"eligibility":40,"win":8,"reasoning":"Poor fit."}');
    expect(r.match).toBe(15);
    expect(r.eligibility).toBe(40);
    expect(r.win).toBe(8);
    expect(r.reasoning).toBe("Poor fit.");
  });

  it("extracts JSON from ```json fences and surrounding prose", () => {
    const text =
      'Here is my assessment:\n```json\n{"match": 72, "eligibility": 85, "win": 61, "reasoning": "Strong fit."}\n```\nHope that helps.';
    const r = parseAiScore(text);
    expect(r.match).toBe(72);
    expect(r.win).toBe(61);
  });

  it("clamps out-of-range and rounds fractional scores", () => {
    const r = parseAiScore('{"match":120,"eligibility":-5,"win":33.7,"reasoning":"x"}');
    expect(r.match).toBe(100);
    expect(r.eligibility).toBe(0);
    expect(r.win).toBe(34);
  });

  it("coerces numeric strings", () => {
    const r = parseAiScore('{"match":"20","eligibility":"50","win":"12","reasoning":"x"}');
    expect(r.match).toBe(20);
  });

  it("throws when no JSON object is present", () => {
    expect(() => parseAiScore("I cannot score this tender.")).toThrow();
  });

  it("throws when required fields are missing", () => {
    expect(() => parseAiScore('{"match":20}')).toThrow();
  });
});
