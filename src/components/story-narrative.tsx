import { Link } from "@tanstack/react-router";
import type { ProfileSettings } from "@/lib/format";
import {
  formatNumber,
  formatDistance,
  formatCostPerKm,
  unitLongLabel,
} from "@/lib/format";

export type SpendingBucket = {
  key: "fuel" | "servicing" | "repairs" | "other";
  label: string;
  pct: number;
};

// One entry per fuel-role category with logged fill-ups.
export type StoryFuelSource = {
  category_id: string;
  name: string;
  unit: string;
  quantity: number;
  avg: number | null;
};

type Props = {
  vehicleId: string;
  vehicleName: string;
  lifetimeKm: number;
  costPerKmMinor: number | null;
  fuelSources: StoryFuelSource[];
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
  const sources = p.fuelSources.filter((s) => s.quantity > 0);
  const hasFuel = sources.length > 0;

  // "1 234 litres" / "456 kWh" — non-breaking between number and unit.
  const qtyText = (s: StoryFuelSource) =>
    `${formatNumber(Math.round(s.quantity), 0, p.settings.currency)}\u00A0${unitLongLabel(s.unit)}`;
  // "7,85 litres / 100 km" / "18,20 kWh / 100 km" — spaced non-breaking slash.
  const consText = (s: StoryFuelSource) =>
    s.avg != null
      ? `${formatNumber(s.avg, 2, p.settings.currency)}\u00A0${unitLongLabel(s.unit)}\u00A0/\u00A0100\u00A0km`
      : null;

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
          {sources.map((s, i) => {
            const cons = consText(s);
            const sep =
              i === 0 ? null : i === sources.length - 1 ? " and " : ", ";
            return (
              <span key={s.category_id}>
                {sep}
                <Link to="/insights" hash="consumption" className="story-pill">
                  {qtyText(s)}
                </Link>
                {cons ? (
                  <>
                    {sources.length === 1 ? " at an average " : " "}
                    <Link to="/insights" hash="consumption" className="story-pill">
                      {cons}
                    </Link>
                  </>
                ) : null}
              </span>
            );
          })}
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
