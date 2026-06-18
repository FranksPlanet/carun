import { Link } from "@tanstack/react-router";
import type { ProfileSettings } from "@/lib/format";
import {
  formatNumber,
  formatDistance,
  formatCostPerKm,
  formatVolume,
  formatPricePerLiter,
  formatConsumption,
} from "@/lib/format";

const NBSP = "\u00A0";

// Compact distance like "25k km" / "850 km" / "1,2k km".
function formatDistanceShort(km: number, settings: ProfileSettings): string {
  const KM_TO_MI = 0.621371;
  const isMi = settings.distance_unit === "mi";
  const v = isMi ? km * KM_TO_MI : km;
  const unit = isMi ? "mi" : "km";
  if (!isFinite(v)) return `—${NBSP}${unit}`;
  if (v < 1000) return `${formatNumber(Math.round(v), 0, settings.currency)}${NBSP}${unit}`;
  const k = v / 1000;
  const frac = k < 10 ? 1 : 0;
  let num = formatNumber(k, frac, settings.currency);
  // strip trailing ",0" / ".0"
  num = num.replace(/[.,]0+$/, "");
  return `${num}k${NBSP}${unit}`;
}

type Props = {
  vehicleId: string;
  vehicleName: string;
  lifetimeKm: number;
  costPerKmMinor: number | null;
  totalLiters: number;
  pricePerLiterMinor: number | null;
  avgConsumptionLPer100Km: number | null;
  fuelSharePct: number | null;
  settings: ProfileSettings;
  hasAnyExpense: boolean;
};

export function StoryNarrative(p: Props) {
  if (!p.hasAnyExpense) {
    return (
      <p className="text-base text-muted-foreground leading-relaxed">
        Start logging and your car's story shows up here.
      </p>
    );
  }

  const hasKm = p.lifetimeKm > 0 && p.costPerKmMinor != null && p.costPerKmMinor > 0;
  const hasFuel =
    p.totalLiters > 0 &&
    p.pricePerLiterMinor != null &&
    p.avgConsumptionLPer100Km != null &&
    p.fuelSharePct != null;

  return (
    <div className="display text-foreground text-[1.5rem] sm:text-3xl leading-snug tracking-tight space-y-3">
      {hasKm && (
        <p>
          {p.vehicleName} has driven{" "}
          <Link to="/insights" hash="lifetime" className="story-pill">
            {formatDistanceShort(p.lifetimeKm, p.settings)}
          </Link>{" "}
          at{" "}
          <Link to="/insights" hash="lifetime" className="story-pill">
            {formatCostPerKm(p.costPerKmMinor as number, p.settings, 1)}
          </Link>
          .
        </p>
      )}
      {hasFuel && (
        <p>
          You've burned{" "}
          <Link to="/insights" hash="consumption" className="story-pill">
            {formatVolume(p.totalLiters, p.settings, 0)}
          </Link>{" "}
          at an average{" "}
          <Link to="/insights" hash="consumption" className="story-pill">
            {formatPricePerLiter(p.pricePerLiterMinor as number, p.settings)}
          </Link>{" "}
          (
          <Link to="/insights" hash="consumption" className="story-pill">
            {formatConsumption(p.avgConsumptionLPer100Km, p.settings)}
          </Link>
          ) — that's{" "}
          <Link to="/expenses" hash="category-breakdown" className="story-pill">
            {formatNumber(p.fuelSharePct as number, 0, p.settings.currency)}%
          </Link>{" "}
          of what the car costs you.
        </p>
      )}
      {!hasKm && !hasFuel && (
        <p className="text-muted-foreground text-base">
          Your story will fill in as you log more.
        </p>
      )}
      {/* Suppress unused-var warning for vehicleId; kept for future deep-link state. */}
      <span hidden data-vehicle-id={p.vehicleId} />
    </div>
  );
}
