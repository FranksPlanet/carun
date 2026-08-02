import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  useCategories,
  ICON_NAMES,
  ICON_MAP,
  COLOR_PALETTE,
  ROLE_META,
  CategoryIcon,
  type CategoryRow,
  type CategoryRole,
} from "@/lib/categories";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from "@/lib/categories.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

type Draft = {
  id?: string;
  name: string;
  color: string;
  icon: string;
  role: CategoryRole;
  unit: string;
  description: string;
};

const UNIT_PRESETS = ["l", "kWh", "kg"];

const emptyDraft = (): Draft => ({
  name: "",
  color: COLOR_PALETTE[0],
  icon: "Tag",
  role: "other",
  unit: "l",
  description: "",
});

export function CategoriesManager() {
  const qc = useQueryClient();
  const catsQ = useCategories();
  const cats = catsQ.data ?? [];

  const createFn = useServerFn(createCategory);
  const updateFn = useServerFn(updateCategory);
  const deleteFn = useServerFn(deleteCategory);
  const reorderFn = useServerFn(reorderCategories);

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");

  const fuelCount = cats.filter((c) => c.role === "fuel").length;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["categories"] });

  const saveMut = useMutation({
    mutationFn: async (d: Draft) => {
      const payload = {
        name: d.name.trim(),
        color: d.color,
        icon: d.icon,
        role: d.role,
        unit: d.role === "fuel" ? d.unit.trim() || "l" : null,
        description: d.description.trim() || null,
      };
      if (d.id) {
        return updateFn({ data: { id: d.id, ...payload } });
      }
      return createFn({ data: { ...payload, sort_order: (cats.at(-1)?.sort_order ?? 0) + 10 } });
    },
    onSuccess: () => {
      invalidate();
      setEditorOpen(false);
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const deleteMut = useMutation({
    mutationFn: async (vars: { id: string; reassign_to?: string }) =>
      deleteFn({ data: vars }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setDeleteTarget(null);
      setReassignTo("");
      toast.success("Deleted");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const reorderMut = useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) =>
      reorderFn({ data: { items } }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? "Failed to reorder"),
  });

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= cats.length) return;
    const reordered = [...cats];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    reorderMut.mutate(reordered.map((c, i) => ({ id: c.id, sort_order: (i + 1) * 10 })));
  }

  function openAdd() {
    setDraft(emptyDraft());
    setEditorOpen(true);
  }

  function openEdit(c: CategoryRow) {
    setDraft({
      id: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      role: c.role,
      unit: c.unit ?? "l",
      description: c.description ?? "",
    });
    setEditorOpen(true);
  }

  const isLastFuelDraft =
    draft.id != null && cats.find((c) => c.id === draft.id)?.role === "fuel" && fuelCount === 1;

  const canDeleteSelected =
    deleteTarget != null && !(deleteTarget.role === "fuel" && fuelCount === 1);

  const reassignOptions = deleteTarget ? cats.filter((c) => c.id !== deleteTarget.id) : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Manage the categories you tag expenses with. Each has a role used by analytics — the
          fuel role drives consumption maths and can't be removed entirely.
        </p>
        <Button onClick={openAdd} className="rounded-full shrink-0">
          <Plus className="size-4 mr-1" /> Add
        </Button>
      </div>

      {catsQ.isLoading ? (
        <ul className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {cats.map((c, idx) => (
            <li
              key={c.id}
              className="rounded-lg border border-border bg-card p-3 flex items-start gap-3"
            >
              <div
                className="size-10 rounded-full grid place-items-center shrink-0"
                style={{
                  backgroundColor: `color-mix(in oklab, ${c.color} 18%, var(--color-card))`,
                }}
              >
                <CategoryIcon category={c} className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-semibold truncate">{c.name}</span>
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {ROLE_META[c.role].label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.description || ROLE_META[c.role].description}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Move up"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0 || reorderMut.isPending}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Move down"
                  onClick={() => move(idx, 1)}
                  disabled={idx === cats.length - 1 || reorderMut.isPending}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edit category"
                  onClick={() => openEdit(c)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete category"
                  onClick={() => {
                    setDeleteTarget(c);
                    setReassignTo("");
                  }}
                  disabled={c.role === "fuel" && fuelCount === 1}
                  title={c.role === "fuel" && fuelCount === 1 ? "At least one fuel category is required" : undefined}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                maxLength={40}
              />
            </div>

            <div>
              <Label htmlFor="cat-desc">Description (optional)</Label>
              <Input
                id="cat-desc"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                maxLength={200}
                placeholder={ROLE_META[draft.role].description}
              />
            </div>

            <div>
              <Label>Role</Label>
              <Select
                value={draft.role}
                onValueChange={(v) => setDraft({ ...draft, role: v as CategoryRole })}
                disabled={isLastFuelDraft}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_META) as CategoryRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_META[r].label} — {ROLE_META[r].description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isLastFuelDraft && (
                <p className="text-xs text-muted-foreground mt-1">
                  This is the only fuel category — its role can't be changed.
                </p>
              )}
            </div>

            {draft.role === "fuel" && (
              <div>
                <Label htmlFor="cat-unit">Unit</Label>
                <div className="flex flex-wrap gap-2 mt-1 mb-2">
                  {UNIT_PRESETS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      className="tag-chip"
                      data-on={draft.unit === u}
                      onClick={() => setDraft({ ...draft, unit: u })}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <Input
                  id="cat-unit"
                  value={draft.unit}
                  maxLength={12}
                  onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                  placeholder="l"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  What you buy this in — drives consumption maths (per 100 km).
                </p>
              </div>
            )}

            <div>
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Use colour ${c}`}
                    className="size-7 rounded-full border-2"
                    style={{
                      backgroundColor: c,
                      borderColor: draft.color === c ? "var(--color-foreground)" : "transparent",
                    }}
                    onClick={() => setDraft({ ...draft, color: c })}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ICON_NAMES.map((name) => {
                  const Icon = ICON_MAP[name];
                  const on = draft.icon === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-label={`Use icon ${name}`}
                      className="size-9 rounded-md grid place-items-center border"
                      style={{
                        borderColor: on ? draft.color : "var(--color-border)",
                        backgroundColor: on
                          ? `color-mix(in oklab, ${draft.color} 18%, var(--color-card))`
                          : "transparent",
                      }}
                      onClick={() => setDraft({ ...draft, icon: name })}
                    >
                      <Icon className="size-4" style={{ color: draft.color }} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMut.mutate(draft)}
              disabled={saveMut.isPending || draft.name.trim().length === 0}
            >
              {saveMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete + reassign */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Pick another category to move any existing expenses to. Categories with no
              expenses can be deleted without reassigning.
            </p>
            <div>
              <Label>Reassign expenses to</Label>
              <Select value={reassignTo} onValueChange={setReassignTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a category…" />
                </SelectTrigger>
                <SelectContent>
                  {reassignOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {ROLE_META[c.role].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!canDeleteSelected || deleteMut.isPending}
              onClick={() =>
                deleteTarget &&
                deleteMut.mutate({
                  id: deleteTarget.id,
                  reassign_to: reassignTo || undefined,
                })
              }
            >
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
