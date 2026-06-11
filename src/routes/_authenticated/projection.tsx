import { createFileRoute } from "@tanstack/react-router";
import { t } from "@/lib/strings";

export const Route = createFileRoute("/_authenticated/projection")({
  head: () => ({ meta: [{ title: "Projection — RunningCost" }] }),
  component: ProjectionPage,
});

function ProjectionPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">{t.nav.projection}</h1>
      <p className="text-muted-foreground">
        Long-term cost projection will appear here once you have enough logged data.
      </p>
    </div>
  );
}
