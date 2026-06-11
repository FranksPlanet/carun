import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "Insights — RunningCost" }] }),
  component: InsightsPage,
});

function InsightsPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Insights</h1>
      <div className="kpi-card text-center py-12">
        <p className="text-muted-foreground">
          Coming soon — consumption trends, projections, and lifetime cost estimates will live here.
        </p>
      </div>
    </div>
  );
}
