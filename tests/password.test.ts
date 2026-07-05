import { describe, expect, it } from "vitest";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/password";

describe("hashPassword / verifyPassword", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("Sup3rSecret");
    expect(await verifyPassword("Sup3rSecret", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Sup3rSecret");
    expect(await verifyPassword("wrongpass1", hash)).toBe(false);
  });

  it("never stores the raw password", async () => {
    const hash = await hashPassword("PlaintextLeak1");
    expect(hash).not.toContain("PlaintextLeak1");
    expect(hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it("produces a different hash for the same password (unique salt)", async () => {
    const a = await hashPassword("SamePass123");
    const b = await hashPassword("SamePass123");
    expect(a).not.toEqual(b);
    // ...but both still verify
    expect(await verifyPassword("SamePass123", a)).toBe(true);
    expect(await verifyPassword("SamePass123", b)).toBe(true);
  });

  it("returns false on a malformed stored hash", async () => {
    expect(await verifyPassword("whatever", "not-a-valid-hash")).toBe(false);
  });
});

describe("validatePasswordStrength", () => {
  it("accepts a valid password", () => {
    expect(validatePasswordStrength("abc12345")).toBeNull();
  });

  it("rejects short passwords", () => {
    expect(validatePasswordStrength("ab1")).toMatch(/8 characters/);
  });

  it("rejects passwords without a number", () => {
    expect(validatePasswordStrength("onlyletters")).toMatch(/letter and one number/);
  });

  it("rejects passwords without a letter", () => {
    expect(validatePasswordStrength("12345678")).toMatch(/letter and one number/);
  });
});
