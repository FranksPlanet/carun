import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listVehicles } from "@/lib/vehicles.functions";
import { getProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Plus, Car } from "lucide-react";
import { t } from "@/lib/strings";
import { defaultSettings, formatDistance } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/garage")({
  head: () => ({ meta: [{ title: "Garage — RevTab" }] }),
  component: GaragePage,
});

function GaragePage() {
  const navigate = useNavigate();
  const fetchVehicles = useServerFn(listVehicles);
  const fetchProfile = useServerFn(getProfile);
  const vehiclesQ = useQuery({ queryKey: ["vehicles"], queryFn: () => fetchVehicles() });
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const vehicles = vehiclesQ.data ?? [];
  const settings = profileQ.data ?? defaultSettings;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">{t.nav.garage}</h1>
        <Button onClick={() => navigate({ to: "/onboarding" })} className="rounded-full">
          <Plus className="size-4 mr-1" /> Add vehicle
        </Button>
      </div>

      {vehiclesQ.isLoading ? (
        <ul className="grid gap-3">
          {[0, 1].map((i) => (
            <li key={i} className="kpi-card h-20 animate-pulse" />
          ))}
        </ul>
      ) : vehicles.length === 0 ? (
        <div className="kpi-card text-center py-12">
          <Car className="size-10 mx-auto mb-3 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground mb-4">{t.empty.noVehicles}</p>
          <Link to="/onboarding">
            <Button className="rounded-full"><Plus className="size-4 mr-1" /> Add vehicle</Button>
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {vehicles.map((v: any) => (
            <li key={v.id} className="kpi-card flex items-center gap-3">
              <div className="size-10 shrink-0 rounded-xl bg-secondary grid place-items-center">
                <Car className="size-5 text-primary" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display font-semibold truncate">{v.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {v.plate ? `${v.plate} · ` : ""}{cap(v.fuel_type)} · {formatDistance(v.current_odometer_km ?? 0, settings)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
