import { describe, expect, it } from "vitest";
import { effectiveCurrentOdometerKm, maxExpenseOdometer } from "@/lib/odometer";

const v = (km: number | null | undefined) => ({ current_odometer_km: km });
const e = (km: number | null) => ({ odometer_km: km });

describe("effectiveCurrentOdometerKm", () => {
  it("falls back to the stored value when there are no expenses", () => {
    expect(effectiveCurrentOdometerKm(v(120000), [])).toBe(120000);
    expect(effectiveCurrentOdometerKm(v(120000), undefined)).toBe(120000);
  });

  it("returns the highest expense reading when expenses are ahead of stored", () => {
    expect(effectiveCurrentOdometerKm(v(120000), [e(150000), e(180000), e(130000)])).toBe(180000);
  });

  it("keeps the stored value when every expense is behind it", () => {
    expect(effectiveCurrentOdometerKm(v(180000), [e(120000), e(150000)])).toBe(180000);
  });

  it("returns the shared value when stored and highest expense are equal", () => {
    expect(effectiveCurrentOdometerKm(v(150000), [e(150000), e(120000)])).toBe(150000);
  });

  it("treats a missing or null stored odometer as 0", () => {
    expect(effectiveCurrentOdometerKm(v(null), [e(90000)])).toBe(90000);
    expect(effectiveCurrentOdometerKm(null, [])).toBe(0);
  });

  it("ignores null and non-finite odometer readings", () => {
    expect(maxExpenseOdometer([e(null), e(NaN as unknown as number), e(1000)])).toBe(1000);
    expect(maxExpenseOdometer([])).toBe(0);
  });
});
