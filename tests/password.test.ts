import { describe, it, expect } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  validateNewPassword,
  validatePasswordPair,
} from "@/lib/password";

describe("validateNewPassword", () => {
  it("accepts a password at or above the minimum length", () => {
    expect(validateNewPassword("a".repeat(PASSWORD_MIN_LENGTH))).toEqual({ ok: true });
    expect(validateNewPassword("correct horse battery staple")).toEqual({ ok: true });
  });

  it("rejects an empty or missing password", () => {
    expect(validateNewPassword("")).toMatchObject({ ok: false });
    expect(validateNewPassword(undefined)).toMatchObject({ ok: false });
    expect(validateNewPassword(12345678)).toMatchObject({ ok: false });
  });

  it("rejects a password shorter than the minimum", () => {
    const result = validateNewPassword("a".repeat(PASSWORD_MIN_LENGTH - 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(String(PASSWORD_MIN_LENGTH));
  });

  it("rejects whitespace-only passwords", () => {
    expect(validateNewPassword("          ")).toMatchObject({ ok: false });
  });
});

describe("validatePasswordPair", () => {
  it("accepts a matching, long-enough pair", () => {
    expect(validatePasswordPair("hunter2hunter2", "hunter2hunter2")).toEqual({ ok: true });
  });

  it("reports mismatches", () => {
    const result = validatePasswordPair("hunter2hunter2", "hunter2hunter3");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/don't match/i);
  });

  it("reports a missing confirmation", () => {
    expect(validatePasswordPair("hunter2hunter2", "")).toMatchObject({ ok: false });
  });

  it("reports the length problem before the mismatch", () => {
    const result = validatePasswordPair("short", "different");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(String(PASSWORD_MIN_LENGTH));
  });
});
