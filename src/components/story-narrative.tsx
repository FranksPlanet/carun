import { Link } from "@tanstack/react-router";
import type { ProfileSettings } from "@/lib/format";
import {
  formatNumber,
  formatDistance,
  formatCostPerKm,
  formatVolume,
  formatConsumption,
} from "@/lib/format";

export type SpendingBucket = {
  key: "fuel" | "servicing" | "repairs" | "other";
  label: string;
  pct: number;
};

type Props = {
  vehicleId: string;
  vehicleName: string;
  lifetimeKm: number;
  costPerKmMinor: number | null;
  totalLiters: number;
  avgConsumptionLPer100Km: number | null;
  buckets: SpendingBucket[];
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
  const hasFuel = p.totalLiters > 0 && p.avgConsumptionLPer100Km != null;

  // Litres, spelled out, non-breaking between number and unit.
  const litresText = `${formatNumber(Math.round(p.totalLiters), 0, p.settings.currency)}\u00A0litres`;
  // Consumption as "X,XX litres / 100 km" (spaced slash, non-breaking).
  const consText =
    p.avgConsumptionLPer100Km != null
      ? `${formatNumber(p.avgConsumptionLPer100Km, 2, p.settings.currency)}\u00A0litres\u00A0/\u00A0100\u00A0km`
      : "—";

  const buckets = p.buckets.filter((b) => b.pct > 0).slice(0, 4);

  return (
    <div className="display text-foreground text-[1.25rem] sm:text-2xl leading-snug tracking-tight space-y-4">
      {hasKm && (
        <p>
          {p.vehicleName} has driven{" "}
          <Link to="/insights" hash="lifetime" className="story-pill">
            {formatDistance(p.lifetimeKm, p.settings, 0)}
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
            {litresText}
          </Link>{" "}
          at an average{" "}
          <Link to="/insights" hash="consumption" className="story-pill">
            {consText}
          </Link>
          .
        </p>
      )}
      {buckets.length > 0 && (
        <p>
          {buckets.map((b, i) => {
            const pctPill = (
              <Link
                key={b.key}
                to="/expenses"
                hash="category-breakdown"
                className="story-pill"
              >
                {formatNumber(b.pct, 0, p.settings.currency)}%
              </Link>
            );
            if (i === 0) {
              return (
                <span key={b.key}>
                  {pctPill} of your spending is {b.label}
                  {buckets.length > 1 ? ", " : "."}
                </span>
              );
            }
            const sep = i === buckets.length - 1 ? "." : ", ";
            return (
              <span key={b.key}>
                {pctPill} {b.label}
                {sep}
              </span>
            );
          })}
        </p>
      )}
      {!hasKm && !hasFuel && buckets.length === 0 && (
        <p className="text-muted-foreground text-base">
          Your story will fill in as you log more.
        </p>
      )}
      <span hidden data-vehicle-id={p.vehicleId} />
    </div>
  );
}
