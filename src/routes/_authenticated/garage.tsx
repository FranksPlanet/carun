import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listVehicles } from "@/lib/vehicles.functions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { t } from "@/lib/strings";

export const Route = createFileRoute("/_authenticated/garage")({
  head: () => ({ meta: [{ title: "Garage — RunningCost" }] }),
  component: GaragePage,
});

function GaragePage() {
  const navigate = useNavigate();
  const fetchVehicles = useServerFn(listVehicles);
  const vehiclesQ = useQuery({ queryKey: ["vehicles"], queryFn: () => fetchVehicles() });
  const vehicles = vehiclesQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">{t.nav.garage}</h1>
        <Button onClick={() => navigate({ to: "/onboarding" })}>
          <Plus className="size-4 mr-1" /> Add vehicle
        </Button>
      </div>

      {vehiclesQ.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{t.empty.noVehicles}</p>
          <Link to="/onboarding">
            <Button><Plus className="size-4 mr-1" /> Add vehicle</Button>
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {vehicles.map((v: any) => (
            <li key={v.id} className="kpi-card">
              <div className="font-display">{v.name}</div>
              <div className="text-xs text-muted-foreground">{v.fuel_type ?? ""}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
