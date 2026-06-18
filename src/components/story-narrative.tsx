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
      <div
        className="rounded-2xl p-4 sm:p-5 text-sm leading-relaxed"
        style={{ background: "var(--color-secondary)", borderColor: "var(--color-border)" }}
      >
        <p className="text-foreground">
          Start logging and your car's story shows up here.
        </p>
      </div>
    );
  }

  const hasKm = p.lifetimeKm > 0 && p.costPerKmMinor != null && p.costPerKmMinor > 0;
  const hasFuel =
    p.totalLiters > 0 &&
    p.pricePerLiterMinor != null &&
    p.avgConsumptionLPer100Km != null &&
    p.fuelSharePct != null;

  return (
    <div
      className="rounded-2xl p-4 sm:p-5 text-base leading-relaxed border"
      style={{
        background: "var(--color-secondary)",
        borderColor: "color-mix(in oklab, var(--color-secondary) 70%, var(--color-foreground) 8%)",
      }}
    >
      <p className="text-foreground">
        {hasKm && (
          <>
            You've driven{" "}
            <Link to="/insights" hash="lifetime" className="story-pill">
              <span className="num">{formatDistance(km, p.settings, 0)}</span>
            </Link>{" "}
            at{" "}
            <Link to="/insights" hash="lifetime" className="story-pill">
              <span className="num">{formatCostPerKm(cpk, p.settings)}</span>
            </Link>
            {hasFuel ? ". " : "."}
          </>
        )}
        {hasFuel && (
          <>
            You've burned{" "}
            <Link to="/insights" hash="consumption" className="story-pill">
              <span className="num">{formatVolume(liters, p.settings, 0)}</span>
            </Link>{" "}
            at an average{" "}
            <Link to="/insights" hash="fuel-price" className="story-pill">
              <span className="num">{formatPricePerLiter(price, p.settings)}</span>
            </Link>
            {" "}({formatConsumption(p.avgConsumptionLPer100Km, p.settings)}) — that's{" "}
            <Link to="/expenses" hash="category-breakdown" className="story-pill">
              <span className="num">{formatNumber(share, 0, p.settings.currency)}%</span>
            </Link>{" "}
            of what the car costs you.
          </>
        )}
        {!hasKm && !hasFuel && (
          <span className="text-muted-foreground">
            Your story will fill in as you log more.
          </span>
        )}
      </p>
    </div>
  );
}
