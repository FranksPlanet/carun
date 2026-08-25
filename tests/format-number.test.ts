import { describe, it, expect } from "vitest";
import { parseLocalNumber } from "@/lib/format";
import { coerceNumber } from "@/lib/ocr-parse";

// These lock down the locale disambiguation rule: whichever of "," or "."
// appears LAST is the decimal separator; the other groups thousands.
describe("parseLocalNumber", () => {
  it("parses dot-as-thousands (Czech/German) input", () => {
    expect(parseLocalNumber("107.760")).toBe(107760);
    expect(parseLocalNumber("1.234,50")).toBe(1234.5);
    expect(parseLocalNumber("1.234.567,89")).toBeCloseTo(1234567.89, 6);
  });

  it("keeps the previously-correct cases working", () => {
    expect(parseLocalNumber("1 234,56")).toBeCloseTo(1234.56, 6);
    expect(parseLocalNumber("1,234.56")).toBeCloseTo(1234.56, 6);
    expect(parseLocalNumber("1234.56")).toBeCloseTo(1234.56, 6);
    expect(parseLocalNumber("1234,56")).toBeCloseTo(1234.56, 6);
  });

  it("handles NBSP and narrow-NBSP thousands separators", () => {
    expect(parseLocalNumber("1\u00a0234,56")).toBeCloseTo(1234.56, 6);
    expect(parseLocalNumber("107\u202f760")).toBe(107760);
  });

  it("parses plain integers", () => {
    expect(parseLocalNumber("0")).toBe(0);
    expect(parseLocalNumber("7")).toBe(7);
    expect(parseLocalNumber("107760")).toBe(107760);
    expect(parseLocalNumber(" 42 ")).toBe(42);
  });

  it("parses negative numbers", () => {
    expect(parseLocalNumber("-5")).toBe(-5);
    expect(parseLocalNumber("-1.234,50")).toBe(-1234.5);
  });

  it("ignores trailing units and currency symbols", () => {
    expect(parseLocalNumber("1 615,10 Kč")).toBeCloseTo(1615.1, 6);
    expect(parseLocalNumber("41,52 L")).toBeCloseTo(41.52, 6);
  });

  it("returns NaN for empty and unparseable input", () => {
    expect(parseLocalNumber("")).toBeNaN();
    expect(parseLocalNumber("   ")).toBeNaN();
    expect(parseLocalNumber("abc")).toBeNaN();
    expect(parseLocalNumber("--")).toBeNaN();
    // @ts-expect-error guarding runtime null from loosely-typed callers
    expect(parseLocalNumber(null)).toBeNaN();
  });

  it("agrees with coerceNumber, the single shared implementation", () => {
    for (const s of ["107.760", "1.234,50", "1 234,56", "1,234.56", "1234.56", "-5"]) {
      expect(parseLocalNumber(s)).toBe(coerceNumber(s));
    }
  });
});
