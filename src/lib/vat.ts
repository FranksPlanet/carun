// Pure VAT helpers. Deliberately dependency-free and never imported by
// calc.ts — the calc engine stays completely unaware of VAT. Callers
// transform rows (swap `amount_minor` for the net amount) BEFORE handing
// them to calc.ts when the user is viewing prices ex-VAT.

export type VatSplit = { net: number; vat: number; known: boolean };

/**
 * Split a gross (VAT-inclusive) amount in minor units into net + VAT.
 * `net + vat` always equals `gross` exactly — no rounding drift.
 * A null rate means "unknown", which is different from 0%.
 */
export function vatSplit(grossMinor: number, rate: number | null | undefined): VatSplit {
  if (rate == null || !isFinite(rate)) return { net: grossMinor, vat: 0, known: false };
  const net = Math.round(grossMinor / (1 + rate / 100));
  return { net, vat: grossMinor - net, known: true };
}

/**
 * Return rows with `amount_minor` replaced by the net amount when `exVat`
 * is true and the row's rate is known. Rows with an unknown rate pass
 * through untouched.
 */
export function applyVatView<T extends { amount_minor: number; vat_rate?: number | null }>(
  rows: T[],
  exVat: boolean,
): T[] {
  if (!exVat) return rows;
  return rows.map((r) => {
    const split = vatSplit(r.amount_minor, r.vat_rate ?? null);
    return split.known ? { ...r, amount_minor: split.net } : r;
  });
}

/** Aggregate gross / net / VAT over a set of rows, flagging unknown rates. */
export function vatTotals(rows: { amount_minor: number; vat_rate?: number | null }[]) {
  let gross = 0;
  let net = 0;
  let vat = 0;
  let unknownCount = 0;
  let unknownGross = 0;
  for (const r of rows) {
    const s = vatSplit(r.amount_minor, r.vat_rate ?? null);
    gross += r.amount_minor;
    net += s.net;
    vat += s.vat;
    if (!s.known) {
      unknownCount += 1;
      unknownGross += r.amount_minor;
    }
  }
  return { gross, net, vat, unknownCount, unknownGross };
}
