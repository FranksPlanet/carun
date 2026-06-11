import { createFileRoute } from "@tanstack/react-router";
import { t } from "@/lib/strings";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses — RunningCost" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">{t.nav.expenses}</h1>
      <p className="text-muted-foreground">{t.empty.noExpenses}</p>
    </div>
  );
}
