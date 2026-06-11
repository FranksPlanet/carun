import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { createVehicle } from "@/lib/vehicles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/strings";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Add vehicle — RunningCost" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createVehicle);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await create({ data: { name: name.trim() } as any });
      await qc.invalidateQueries({ queryKey: ["vehicles"] });
      navigate({ to: "/dashboard" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl">{t.onboarding.basicsTitle}</h1>
        <p className="text-muted-foreground text-sm">{t.onboarding.framing}</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Vehicle name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Daily Octavia"
            autoFocus
          />
        </div>
        <Button type="submit" disabled={submitting || !name.trim()}>
          {submitting ? "Saving…" : t.onboarding.finish}
        </Button>
      </form>
    </div>
  );
}
