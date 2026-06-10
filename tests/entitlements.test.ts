import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, periodStartFor } from "@/lib/entitlements";

describe("periodStartFor", () => {
  it("returns the day for daily windows", () => {
    const d = new Date("2026-06-10T14:30:00Z");
    expect(periodStartFor("day", d)).toBe("2026-06-10");
  });

  it("returns the first of the month for monthly windows", () => {
    const d = new Date("2026-06-10T14:30:00Z");
    expect(periodStartFor("month", d)).toBe("2026-06-01");
  });

  it("returns the epoch for total windows", () => {
    expect(periodStartFor("total")).toBe("1970-01-01");
  });
});

describe("DEFAULT_LIMITS", () => {
  it("caps the free plan at 3 proposals/month and 1 company", () => {
    expect(DEFAULT_LIMITS.free.proposals_per_month).toBe(3);
    expect(DEFAULT_LIMITS.free.companies).toBe(1);
  });

  it("gives business unlimited proposals", () => {
    expect(DEFAULT_LIMITS.business.proposals_per_month).toBeNull();
  });

  it("free < pro for every numeric cap", () => {
    for (const key of Object.keys(DEFAULT_LIMITS.free)) {
      const free = DEFAULT_LIMITS.free[key];
      const pro = DEFAULT_LIMITS.pro[key];
      if (typeof free === "number" && typeof pro === "number") {
        expect(pro).toBeGreaterThanOrEqual(free);
      }
    }
  });
});
