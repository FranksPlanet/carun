import { describe, it, expect } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it("allows a same-origin relative path", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/oauth/consent?client_id=abc")).toBe("/oauth/consent?client_id=abc");
  });

  it("rejects protocol-relative //evil.com", () => {
    expect(safeNextPath("//evil.com")).toBeUndefined();
  });

  it("rejects backslash-smuggled /\\evil.com", () => {
    expect(safeNextPath("/\\evil.com")).toBeUndefined();
  });

  it("rejects absolute URLs", () => {
    expect(safeNextPath("https://evil.com")).toBeUndefined();
  });

  it("rejects empty and non-string values", () => {
    expect(safeNextPath("")).toBeUndefined();
    expect(safeNextPath("   ")).toBeUndefined();
    expect(safeNextPath(undefined)).toBeUndefined();
    expect(safeNextPath(42)).toBeUndefined();
  });

  it("normalises stray backslashes inside the path", () => {
    expect(safeNextPath("/a\\b")).toBe("/a/b");
  });
});
