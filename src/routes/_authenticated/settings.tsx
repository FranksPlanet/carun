import { createFileRoute } from "@tanstack/react-router";
import { t } from "@/lib/strings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — RunningCost" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">{t.nav.settings}</h1>
      <p className="text-muted-foreground">
        Currency, distance unit, and consumption unit preferences will live here.
      </p>
    </div>
  );
}
