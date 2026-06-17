import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { updateProfile } from "@/lib/profile.functions";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Wrench, Check } from "lucide-react";
import { formatCostPerKm, type ProfileSettings } from "@/lib/format";
import type { CostPerKmMode, CostPerKmViews } from "@/lib/calc";
import { t } from "@/lib/strings";

const MODES: { id: CostPerKmMode; label: string; hint: string }[] = [
  { id: "operating", label: "Operating only", hint: "Everything except the car's capital cost" },
  { id: "with_depreciation", label: "Incl. depreciation", hint: "Honest cost of owning it so far" },
  { id: "with_full_purchase", label: "Incl. full purchase price", hint: "Gross figure incl. the whole sticker" },
];

type Props = {
  views: CostPerKmViews;
  mode: CostPerKmMode;
  settings: ProfileSettings;
};

export function CostPerKmWidget({ views, mode, settings }: Props) {
  const update = useServerFn(updateProfile);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<CostPerKmMode | null>(null);

  async function setMode(next: CostPerKmMode) {
    setSaving(next);
    try {
      await update({ data: { default_cost_per_km_mode: next } });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      setOpen(false);
    } finally {
      setSaving(null);
    }
  }

  const headlineValue = pickValue(views, mode);
  const headlineMode = MODES.find((m) => m.id === mode)!;

  return (
    <div className="kpi-card col-span-2 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="kpi-label">{t.kpi.costPerKm}</div>
          <div className="kpi-value num">
            {headlineValue != null ? formatCostPerKm(headlineValue, settings) : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{headlineMode.label}</div>
          {mode === "with_depreciation" && views.with_depreciation_minor_per_km == null && (
            <p className="text-xs text-muted-foreground mt-1">
              Add an estimated resale value in{" "}
              <Link to="/garage" className="underline text-foreground">Garage</Link>{" "}
              to see this view.
            </p>
          )}
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Change cost-per-km view">
              <Wrench className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <div className="text-sm font-semibold mb-2">Default view</div>
            <div className="space-y-1">
              {MODES.map((m) => {
                const isActive = m.id === mode;
                const unavailable =
                  m.id === "with_depreciation" && views.with_depreciation_minor_per_km == null;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    disabled={saving != null}
                    className="w-full text-left flex items-start gap-2 rounded-md px-2 py-2 hover:bg-secondary"
                  >
                    <Check
                      className={`size-4 mt-0.5 shrink-0 ${isActive ? "opacity-100" : "opacity-0"}`}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{m.label}</span>
                      <span className="block text-xs text-muted-foreground">{m.hint}</span>
                      {unavailable && (
                        <span className="block text-xs text-muted-foreground italic">
                          Needs a resale value to display
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <ul className="grid grid-cols-1 gap-1.5 border-t border-border pt-3">
        {MODES.filter((m) => m.id !== mode).map((m) => {
          const v = pickValue(views, m.id);
          return (
            <li key={m.id} className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">{m.label}</span>
              <span className="text-sm num font-medium">
                {v != null ? (
                  formatCostPerKm(v, settings)
                ) : (
                  <Link to="/garage" className="text-xs underline text-muted-foreground font-normal">
                    Add resale value
                  </Link>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function pickValue(views: CostPerKmViews, mode: CostPerKmMode): number | null {
  switch (mode) {
    case "operating":
      return views.operating_minor_per_km;
    case "with_depreciation":
      return views.with_depreciation_minor_per_km;
    case "with_full_purchase":
      return views.with_full_purchase_minor_per_km;
  }
}
