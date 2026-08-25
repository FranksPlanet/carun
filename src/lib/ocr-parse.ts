// Helpers for normalising loosely-typed values returned by the vision model.
// Kept out of ocr.functions.ts so that file stays a thin server-function wrapper.

/**
 * Accepts a number, or a string like "1 615,10 Kc" / "41,52 L" / "1,615.10".
 * Strips spaces (incl. NBSP, the Czech thousands separator) and any trailing
 * unit/currency characters, converts a comma decimal separator to a dot.
 */
/** Matches a pure thousands-grouped integer, e.g. "107.760", "1,234,567". */
const GROUPED = /^-?\d{1,3}([.,]\d{3})+$/;

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
    // Only commas present: three-digit groups mean thousands ("1,234,567"),
    // anything else is a decimal comma ("41,52").
    s = GROUPED.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot >= 0) {
    // Only dots present: same rule. "107.760" is Czech/German thousands
    // grouping and must not be read as 107.76; "1234.56" stays decimal.
    if (GROUPED.test(s)) s = s.replace(/\./g, "");
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Defensive fallback only — the model is instructed to return ISO already.
 * Accepts ISO "YYYY-MM-DD". For any other numeric date, day-vs-month order is
 * locale-dependent and cannot be resolved here, so we only accept the cases
 * that are unambiguous (one component > 12) and return null otherwise. A wrong
 * date silently corrupts mileage/consumption history, so never guess.
 */
export function coerceDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const num = s.match(/^(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{2,4})$/);
  if (num) {
    const a = parseInt(num[1], 10);
    const b = parseInt(num[2], 10);
    let year = num[3];
    if (year.length === 2) year = `20${year}`;
    let day: number, month: number;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    } else {
      // Both plausible as month → ambiguous (US MM/DD vs DD/MM). Refuse.
      return null;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}
