import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { bulkCreateExpenses } from "@/lib/expenses.functions";
import { moneyMajorToMinor, parseLocalNumber } from "@/lib/format";
import * as XLSX from "xlsx";
import {
  useCategories,
  findCategoryByName,
  defaultForRole,
  type CategoryRow,
} from "@/lib/categories";

type RevTabField = "date" | "odometer" | "category" | "amount" | "quantity" | "note" | "";

const FIELD_LABELS: Record<Exclude<RevTabField, "">, string> = {
  date: "Date",
  odometer: "Odometer (km)",
  category: "Category",
  amount: "Amount",
  quantity: "Quantity (fuel only)",
  note: "Note",
};

const REQUIRED: RevTabField[] = ["date", "odometer", "amount"];

function autodetect(header: string): RevTabField {
  const h = header.toLowerCase().trim();
  if (/^(date|datum|day)/.test(h)) return "date";
  if (/odo|km|mile|tach/.test(h)) return "odometer";
  if (/categ|kateg|type|typ/.test(h)) return "category";
  if (/amount|total|cena|částka|castka|sum|cost|price/.test(h)) return "amount";
  if (/liter|litr|volume|gal/.test(h)) return "quantity";
  if (/note|pozn|comment|memo|desc/.test(h)) return "note";
  return "";
}

// Case-insensitive name match against the user's categories. Never creates a
// new category — unmapped rows fall back to a sensible default the caller picks.
function resolveCategory(
  cats: CategoryRow[],
  raw: any,
  fallback: CategoryRow | undefined,
): CategoryRow | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return fallback;
  return findCategoryByName(cats, s) ?? fallback;
}

function normalizeDate(v: any): string | null {
  if (v == null || v === "") return null;
  // Excel serial date
  if (typeof v === "number" && isFinite(v)) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
  }
  const s = String(v).trim();
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD.MM.YYYY (Czech) or DD/MM/YYYY
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    const [, dd, mm, yyRaw] = m;
    const yy = yyRaw.length === 2 ? `20${yyRaw}` : yyRaw;
    return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(+d)) return d.toISOString().slice(0, 10);
  return null;
}

function normalizeNumber(v: any): number {
  if (typeof v === "number") return v;
  return parseLocalNumber(String(v ?? ""));
}

export function ImportExpensesDialog({
  open,
  onOpenChange,
  vehicleId,
  currency,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  vehicleId: string;
  currency: string;
}) {
  const qc = useQueryClient();
  const bulkFn = useServerFn(bulkCreateExpenses);
  const catsQ = useCategories();
  const cats = catsQ.data ?? [];
  const fuelDefault = defaultForRole(cats, "fuel");
  const routineDefault = defaultForRole(cats, "routine") ?? cats[0];

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<RevTabField, string>>({
    date: "",
    odometer: "",
    category: "",
    amount: "",
    quantity: "",
    note: "",
    "": "",
  });
  const [fileName, setFileName] = useState<string>("");

  function reset() {
    setHeaders([]);
    setRows([]);
    setMapping({ date: "", odometer: "", category: "", amount: "", quantity: "", note: "", "": "" });
    setFileName("");
  }

  async function handleFile(file: File) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".numbers")) {
      toast.error("Apple .numbers isn't supported. Please export to CSV or XLSX.");
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("Empty workbook");
      const json: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (json.length === 0) {
        toast.error("No rows found in the file.");
        return;
      }
      const hs = Object.keys(json[0]);
      const m: Record<RevTabField, string> = {
        date: "",
        odometer: "",
        category: "",
        amount: "",
        quantity: "",
        note: "",
        "": "",
      };
      for (const h of hs) {
        const f = autodetect(h);
        if (f && !m[f]) m[f] = h;
      }
      setHeaders(hs);
      setRows(json);
      setMapping(m);
      setFileName(file.name);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not parse file");
    }
  }

  const preview = useMemo(() => {
    return rows.slice(0, 4).map((r) => ({
      date: mapping.date ? r[mapping.date] : "",
      odometer: mapping.odometer ? r[mapping.odometer] : "",
      category: mapping.category ? r[mapping.category] : "",
      amount: mapping.amount ? r[mapping.amount] : "",
      quantity: mapping.quantity ? r[mapping.quantity] : "",
      note: mapping.note ? r[mapping.note] : "",
    }));
  }, [rows, mapping]);

  const canImport =
    rows.length > 0 && REQUIRED.every((f) => mapping[f] !== "");

  const importMut = useMutation({
    mutationFn: async () => {
      const valid: any[] = [];
      const skipped: string[] = [];
      if (cats.length === 0) {
        throw new Error("Categories aren't loaded yet — please retry in a moment.");
      }
      for (const r of rows) {
        const date = normalizeDate(r[mapping.date]);
        const odo = Math.round(normalizeNumber(r[mapping.odometer]));
        const amt = normalizeNumber(r[mapping.amount]);
        const lt = mapping.quantity ? normalizeNumber(r[mapping.quantity]) : null;
        const note = mapping.note ? String(r[mapping.note] ?? "").slice(0, 500) : null;
        const hasQuantity = lt != null && isFinite(lt) && lt > 0;
        const fallback = hasQuantity ? fuelDefault ?? routineDefault : routineDefault;
        const cat = mapping.category
          ? resolveCategory(cats, r[mapping.category], fallback)
          : fallback;
        if (!date) { skipped.push("invalid date"); continue; }
        if (!isFinite(odo) || odo < 0) { skipped.push("invalid odometer"); continue; }
        if (!isFinite(amt) || amt <= 0) { skipped.push("invalid amount"); continue; }
        if (!cat) { skipped.push("no category available"); continue; }
        const isFuel = cat.role === "fuel";
        valid.push({
          vehicle_id: vehicleId,
          date,
          odometer_km: odo,
          category_id: cat.id,
          amount_minor: moneyMajorToMinor(amt, currency),
          currency,
          quantity: isFuel && hasQuantity ? lt : null,
          full_tank: isFuel ? true : null,
          tags: [],
          note: note || null,
        });
      }
      if (valid.length === 0) {
        throw new Error("No valid rows to import");
      }
      // chunk to stay within 1000-row schema limit
      let inserted = 0;
      for (let i = 0; i < valid.length; i += 500) {
        const slice = valid.slice(i, i + 500);
        const res = await bulkFn({ data: { rows: slice } });
        inserted += res.inserted;
      }
      return { inserted, skipped: skipped.length, reasons: skipped };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["expenses", vehicleId] });
      const reasonSummary = r.skipped > 0
        ? ` Skipped ${r.skipped} (${Array.from(new Set(r.reasons)).slice(0, 3).join(", ")})`
        : "";
      toast.success(`Imported ${r.inserted} row${r.inserted === 1 ? "" : "s"}.${reasonSummary}`);
      onOpenChange(false);
      reset();
    },
    onError: (e: any) => toast.error(e?.message ?? "Import failed"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(b) => {
        onOpenChange(b);
        if (!b) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import expenses</DialogTitle>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload a CSV or XLSX file. You'll map your columns and preview before importing.
            </p>
            <label className="block">
              <span className="sr-only">Choose file</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary file:text-primary-foreground file:px-4 file:py-2 file:font-medium"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Apple .numbers isn't supported — export to CSV or XLSX first.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              {fileName} · {rows.length} rows
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[]).map((f) => (
                <div key={f}>
                  <Label className="text-xs">
                    {FIELD_LABELS[f]}
                    {REQUIRED.includes(f) && <span className="text-primary"> *</span>}
                  </Label>
                  <Select
                    value={mapping[f] || "__none__"}
                    onValueChange={(v) =>
                      setMapping({ ...mapping, [f]: v === "__none__" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div>
              <div className="text-xs font-semibold mb-1">Preview (first {preview.length})</div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      {(["date", "odometer", "category", "amount", "quantity", "note"] as const).map((k) => (
                        <th key={k} className="text-left px-2 py-1 font-medium">
                          {FIELD_LABELS[k]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p, i) => (
                      <tr key={i} className="border-t border-border">
                        {(["date", "odometer", "category", "amount", "quantity", "note"] as const).map((k) => (
                          <td key={k} className="px-2 py-1 align-top">
                            {String(p[k] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {rows.length > 0 && (
            <Button variant="ghost" onClick={reset}>Choose another file</Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!canImport || importMut.isPending}
            onClick={() => importMut.mutate()}
          >
            {importMut.isPending ? "Importing…" : `Import ${rows.length || ""} rows`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
