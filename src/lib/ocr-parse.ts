// Helpers for normalising loosely-typed values returned by the vision model.
// Kept out of ocr.functions.ts so that file stays a thin server-function wrapper.

/**
 * Accepts a number, or a string like "1 615,10 Kc" / "41,52 L" / "1,615.10".
 * Strips spaces (incl. NBSP, the Czech thousands separator) and any trailing
 * unit/currency characters, converts a comma decimal separator to a dot.
 */
export function coerceNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  let s = value.replace(/[\s\u00a0\u202f']/g, "");
  // Drop everything that isn't a digit, separator or sign (units, currency).
  s = s.replace(/[^0-9.,-]/g, "");
  if (!s) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // Whichever comes last is the decimal separator; the other groups thousands.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Accepts "YYYY-MM-DD" or Czech "DD.MM.YYYY" / "D. M. YYYY"; returns ISO or null. */
export function coerceDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const cz = s.match(/^(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{2,4})$/);
  if (cz) {
    const day = cz[1].padStart(2, "0");
    const month = cz[2].padStart(2, "0");
    let year = cz[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  return null;
}
