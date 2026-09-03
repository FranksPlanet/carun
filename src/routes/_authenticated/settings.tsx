import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ErrorState, errorMessage } from "@/components/error-state";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, Download, Trash2, Tag, Gauge, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { exportAllData, deleteAccountAndAllData } from "@/lib/account.functions";
import { getProfile, updateProfile } from "@/lib/profile.functions";
import { CategoriesManager } from "@/components/categories-manager";
import { SignInMethods } from "@/components/sign-in-methods";
import { t } from "@/lib/strings";
import type { CostPerKmMode } from "@/lib/calc";

const CPK_MODES: { id: CostPerKmMode; label: string; hint: string }[] = [
  { id: "operating", label: "Operating only", hint: "Everything except the car's capital cost" },
  { id: "with_depreciation", label: "Incl. depreciation", hint: "Honest cost of owning it so far" },
  { id: "with_full_purchase", label: "Incl. full purchase price", hint: "Gross figure incl. the whole sticker" },
];

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — RevTab" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const exportFn = useServerFn(exportAllData);
  const deleteFn = useServerFn(deleteAccountAndAllData);
  const fetchProfile = useServerFn(getProfile);
  const update = useServerFn(updateProfile);
  const qc = useQueryClient();
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const cpkMode: CostPerKmMode =
    ((profileQ.data as any)?.default_cost_per_km_mode as CostPerKmMode) ?? "with_depreciation";
  const [savingMode, setSavingMode] = useState<CostPerKmMode | null>(null);

  async function setCpkMode(next: CostPerKmMode) {
    setSavingMode(next);
    try {
      await update({ data: { default_cost_per_km_mode: next } });
      await qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSavingMode(null);
    }
  }

  const exVat = Boolean((profileQ.data as any)?.show_prices_ex_vat);
  const [savingVat, setSavingVat] = useState(false);

  async function setExVat(next: boolean) {
    setSavingVat(true);
    try {
      await update({ data: { show_prices_ex_vat: next } });
      await qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSavingVat(false);
    }
  }



  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function onExport() {
    setExporting(true);
    try {
      const bundle = await exportFn();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `revtab-export-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function onDelete() {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    try {
      await deleteFn({ data: { confirm: "DELETE" } });
      await supabase.auth.signOut();
      toast.success("Your account and all data were deleted.");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deletion failed");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <SettingsIcon className="size-6" aria-hidden /> {t.nav.settings}
      </h1>

      {profileQ.isError && (
        <ErrorState
          compact
          title="Couldn't load your settings"
          message={errorMessage(profileQ.error)}
          onRetry={() => profileQ.refetch()}
          retrying={profileQ.isFetching}
        />
      )}

      <section className="kpi-card space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Gauge className="size-4" aria-hidden /> Default cost-per-km view
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose which figure to feature on the dashboard. The other two stay visible underneath.
        </p>
        <div className="grid gap-2">
          {CPK_MODES.map((m) => {
            const active = m.id === cpkMode;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setCpkMode(m.id)}
                disabled={savingMode != null || profileQ.isLoading}
                className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                  active ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
                }`}
              >
                <div className="text-sm font-medium">{m.label}</div>
                <div className="text-xs text-muted-foreground">{m.hint}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="kpi-card space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Receipt className="size-4" aria-hidden /> VAT
        </h2>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="exvat" className="text-sm font-medium">
              Show prices excluding VAT
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              For VAT-registered users who reclaim VAT. Amounts you actually paid are always
              available.
            </p>
          </div>
          <Switch
            id="exvat"
            checked={exVat}
            disabled={savingVat || profileQ.isLoading}
            onCheckedChange={setExVat}
          />
        </div>
      </section>




      <SignInMethods />

      <section className="kpi-card space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Tag className="size-4" aria-hidden /> Categories
        </h2>
        <CategoriesManager />
      </section>

      <section className="kpi-card space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Download className="size-4" aria-hidden /> Export all my data
        </h2>
        <p className="text-sm text-muted-foreground">
          Download a single JSON file with every car, expense, repair, and recurring cost
          tied to your account.
        </p>
        <Button onClick={onExport} disabled={exporting}>
          {exporting ? "Preparing…" : "Download JSON"}
        </Button>
      </section>

      <section className="kpi-card space-y-3 border-destructive/40">
        <h2 className="font-semibold flex items-center gap-2 text-destructive">
          <Trash2 className="size-4" aria-hidden /> Delete account and all data
        </h2>
        <p className="text-sm text-muted-foreground">
          Permanently removes your profile, cars, expenses, repairs, recurring costs,
          uploaded photos, and sign-in. This cannot be undone.
        </p>

        {!confirmOpen ? (
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Delete my account…
          </Button>
        ) : (
          <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <Label htmlFor="confirm" className="text-sm">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm.
            </Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={confirmText !== "DELETE" || deleting}
                onClick={onDelete}
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
