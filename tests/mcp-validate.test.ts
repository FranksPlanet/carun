import { describe, it, expect } from "vitest";
import { isCalendarDate } from "@/lib/mcp/validate";

describe("isCalendarDate", () => {
  it("accepts real dates", () => {
    expect(isCalendarDate("2026-02-28")).toBe(true);
    expect(isCalendarDate("2024-02-29")).toBe(true);
  });
  it("rejects impossible dates", () => {
    expect(isCalendarDate("2026-02-31")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("2026-00-10")).toBe(false);
  });
  it("rejects malformed input", () => {
    expect(isCalendarDate("2026-2-1")).toBe(false);
    expect(isCalendarDate("")).toBe(false);
    expect(isCalendarDate("yesterday")).toBe(false);
  });
});
