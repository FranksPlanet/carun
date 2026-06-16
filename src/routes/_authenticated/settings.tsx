import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";
import { t } from "@/lib/strings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — RevTab" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t.nav.settings}</h1>
      <div className="kpi-card text-center py-10">
        <SettingsIcon className="size-10 mx-auto mb-3 text-muted-foreground" aria-hidden />
        <p className="font-medium">Preferences are coming soon</p>
        <p className="text-sm text-muted-foreground mt-1">
          Currency, distance, volume and consumption units will live here.
        </p>
      </div>
    </div>
  );
}
