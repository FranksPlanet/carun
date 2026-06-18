import { useEffect, useRef, useState } from "react";
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

// Animate a number from 0 → target once, keyed by `key`. Linear-ease cubic.
function useCountUp(target: number, key: string, durationMs = 900): number {
  const [value, setValue] = useState(0);
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    if (!isFinite(target)) { setValue(target); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, key, durationMs]);
  return value;
}

type Props = {
  vehicleId: string;
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
  // animate everything we have, even if not all clauses render
  const km = useCountUp(p.lifetimeKm, `${p.vehicleId}:km`);
  const cpk = useCountUp(p.costPerKmMinor ?? 0, `${p.vehicleId}:cpk`);
  const liters = useCountUp(p.totalLiters, `${p.vehicleId}:liters`);
  const price = useCountUp(p.pricePerLiterMinor ?? 0, `${p.vehicleId}:price`);
  const share = useCountUp(p.fuelSharePct ?? 0, `${p.vehicleId}:share`);

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
    <p className="display text-foreground text-[1.5rem] sm:text-3xl leading-snug tracking-tight">
      {hasKm && (
        <>
          You've driven{" "}
          <Link to="/insights" hash="lifetime" className="story-pill">
            {formatDistance(km, p.settings, 0)}
          </Link>{" "}
          at{" "}
          <Link to="/insights" hash="lifetime" className="story-pill">
            {formatCostPerKm(cpk, p.settings)}
          </Link>
          {hasFuel ? ". " : "."}
        </>
      )}
      {hasFuel && (
        <>
          You've burned{" "}
          <Link to="/insights" hash="consumption" className="story-pill">
            {formatVolume(liters, p.settings, 0)}
          </Link>{" "}
          at an average{" "}
          <Link to="/insights" hash="consumption" className="story-pill">
            {formatPricePerLiter(price, p.settings)}
          </Link>{" "}
          (
          <Link to="/insights" hash="consumption" className="story-pill">
            {formatConsumption(p.avgConsumptionLPer100Km, p.settings)}
          </Link>
          ) — that's{" "}
          <Link to="/expenses" hash="category-breakdown" className="story-pill">
            {formatNumber(share, 0, p.settings.currency)}%
          </Link>{" "}
          of what the car costs you.
        </>
      )}
      {!hasKm && !hasFuel && (
        <span className="text-muted-foreground text-base">
          Your story will fill in as you log more.
        </span>
      )}
    </p>
  );
}
