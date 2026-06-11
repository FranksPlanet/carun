import { createFileRoute } from "@tanstack/react-router";
import { t } from "@/lib/strings";

export const Route = createFileRoute("/_authenticated/fuel")({
  head: () => ({ meta: [{ title: "Fuel — RunningCost" }] }),
  component: FuelPage,
});

function FuelPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">{t.nav.fuel}</h1>
      <p className="text-muted-foreground">{t.empty.needFuel}</p>
    </div>
  );
}
