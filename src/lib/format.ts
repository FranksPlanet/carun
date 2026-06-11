// Display layer: canonical values (minor currency units, km, liters) → user display.
// Storage is always canonical; only this layer formats and converts.

export type ProfileSettings = {
  currency: string;
  distance_unit: "km" | "mi";
  volume_unit: "l" | "gal";
  consumption_style: "l_per_100km" | "km_per_l" | "mpg";
};

export const defaultSettings: ProfileSettings = {
  currency: "CZK",
  distance_unit: "km",
  volume_unit: "l",
  consumption_style: "l_per_100km",
};

const KM_TO_MI = 0.621371;
const L_TO_GAL = 0.264172;

const currencySymbol: Record<string, string> = {
  CZK: "Kč",
  EUR: "€",
  USD: "$",
  GBP: "£",
};

const currencyMinorDigits: Record<string, number> = {
  CZK: 2,
  EUR: 2,
  USD: 2,
  GBP: 2,
};

const localeForCurrency: Record<string, string> = {
  CZK: "cs-CZ",
  EUR: "de-DE",
  USD: "en-US",
  GBP: "en-GB",
};

export function formatNumber(value: number, fraction = 0, currency = "CZK"): string {
  const loc = localeForCurrency[currency] ?? "cs-CZ";
  return new Intl.NumberFormat(loc, {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(value);
}

export function formatMoney(amountMinor: number, settings: ProfileSettings, fraction?: number): string {
  const cur = settings.currency;
  const digits = currencyMinorDigits[cur] ?? 2;
  const major = amountMinor / Math.pow(10, digits);
  const symbol = currencySymbol[cur] ?? cur;
  const f = fraction ?? (Math.abs(major) >= 100 ? 0 : 2);
  return `${formatNumber(major, f, cur)} ${symbol}`;
}

export function moneyMinorToMajor(amountMinor: number, currency: string): number {
  const digits = currencyMinorDigits[currency] ?? 2;
  return amountMinor / Math.pow(10, digits);
}
export function moneyMajorToMinor(major: number, currency: string): number {
  const digits = currencyMinorDigits[currency] ?? 2;
  return Math.round(major * Math.pow(10, digits));
}

export function formatDistance(km: number, settings: ProfileSettings, fraction = 0): string {
  if (settings.distance_unit === "mi") {
    return `${formatNumber(km * KM_TO_MI, fraction, settings.currency)} mi`;
  }
  return `${formatNumber(km, fraction, settings.currency)} km`;
}

export function formatVolume(liters: number, settings: ProfileSettings, fraction = 2): string {
  if (settings.volume_unit === "gal") {
    return `${formatNumber(liters * L_TO_GAL, fraction, settings.currency)} gal`;
  }
  return `${formatNumber(liters, fraction, settings.currency)} l`;
}

export function formatPricePerLiter(pricePerLiter: number, settings: ProfileSettings): string {
  const sym = currencySymbol[settings.currency] ?? settings.currency;
  const digits = currencyMinorDigits[settings.currency] ?? 2;
  const major = pricePerLiter / Math.pow(10, digits);
  if (settings.volume_unit === "gal") {
    return `${formatNumber(major / L_TO_GAL, 2, settings.currency)} ${sym}/gal`;
  }
  return `${formatNumber(major, 2, settings.currency)} ${sym}/l`;
}

export function formatCostPerKm(costPerKm: number, settings: ProfileSettings): string {
  const sym = currencySymbol[settings.currency] ?? settings.currency;
  const digits = currencyMinorDigits[settings.currency] ?? 2;
  const major = costPerKm / Math.pow(10, digits);
  if (settings.distance_unit === "mi") {
    return `${formatNumber(major / KM_TO_MI, 2, settings.currency)} ${sym}/mi`;
  }
  return `${formatNumber(major, 2, settings.currency)} ${sym}/km`;
}

export function formatConsumption(lPer100km: number | null, settings: ProfileSettings): string {
  if (lPer100km == null || !isFinite(lPer100km)) return "—";
  switch (settings.consumption_style) {
    case "km_per_l": {
      const kpl = 100 / lPer100km;
      return `${formatNumber(kpl, 2, settings.currency)} km/l`;
    }
    case "mpg": {
      const mpg = (100 / lPer100km) * KM_TO_MI / L_TO_GAL;
      return `${formatNumber(mpg, 1, settings.currency)} mpg`;
    }
    default:
      return `${formatNumber(lPer100km, 2, settings.currency)} l/100km`;
  }
}

export function currencySymbolFor(currency: string): string {
  return currencySymbol[currency] ?? currency;
}

export function parseLocalNumber(input: string): number {
  if (!input) return NaN;
  // Accept "1 234,56" / "1,234.56" / "1234.56"
  const cleaned = input
    .replace(/\s/g, "")
    .replace(/(\d),(\d{1,2})$/, "$1.$2")
    .replace(/,/g, "");
  return parseFloat(cleaned);
}
