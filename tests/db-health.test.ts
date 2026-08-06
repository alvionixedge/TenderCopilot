import { describe, expect, it } from "vitest";
import { isDbDegraded } from "@/lib/db-health";

describe("isDbDegraded", () => {
  it("treats a reachable database as healthy", () => {
    expect(isDbDegraded("ok")).toBe(false);
  });
  it("treats an unreachable or unconfigured database as degraded", () => {
    // Both must degrade: reads fall back to empty in either case, so the UI
    // must not claim the user has no data.
    expect(isDbDegraded("error")).toBe(true);
    expect(isDbDegraded("unconfigured")).toBe(true);
  });
});
