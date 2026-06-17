import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, Download, Trash2, Tag, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { exportAllData, deleteAccountAndAllData } from "@/lib/account.functions";
import { getProfile, updateProfile } from "@/lib/profile.functions";
import { CategoriesManager } from "@/components/categories-manager";
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
          Download a single JSON file with every vehicle, expense, repair, recurring cost,
          and reminder tied to your account.
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
          Permanently removes your profile, vehicles, expenses, repairs, recurring costs,
          reminders, uploaded photos, and sign-in. This cannot be undone.
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
