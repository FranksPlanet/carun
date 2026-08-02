import {
  Fuel,
  Wrench,
  Receipt,
  Droplet,
  Sparkles,
  Tag,
  Car,
  ShieldCheck,
  ParkingSquare,
  CircleDashed,
  Cog,
  Gauge,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCategories } from "@/lib/categories.functions";

export type CategoryRole = "fuel" | "routine" | "repair" | "admin" | "other";

export type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  role: CategoryRole;
  // Unit of measure for role='fuel' categories ("l", "kWh", "kg", …).
  unit: string | null;
  sort_order: number;

  description: string | null;
  created_at: string;
  updated_at: string;
};

export const ROLE_META: Record<
  CategoryRole,
  { label: string; description: string }
> = {
  fuel: { label: "Fuel", description: "Fuel fill-ups — drives the consumption maths" },
  routine: { label: "Routine", description: "Normal wear — oil, tyres, brake pads" },
  repair: { label: "Repair", description: "Unexpected breakdowns and fixes" },
  admin: { label: "Admin", description: "Insurance, parking, vignette, paperwork" },
  other: { label: "Other", description: "Discretionary extras you didn't have to buy" },
};

// All icons selectable in the category manager. Keep keys stable: they're
// stored verbatim in the database.
export const ICON_MAP: Record<string, LucideIcon> = {
  Fuel,
  Droplet,
  Wrench,
  Receipt,
  Sparkles,
  Tag,
  Car,
  ShieldCheck,
  ParkingSquare,
  CircleDashed,
  Cog,
  Gauge,
  Zap,
};

export const ICON_NAMES = Object.keys(ICON_MAP);

// Preset palette for the colour picker. Muted, modern, chart-readable.
export const COLOR_PALETTE = [
  "#E0A422", // fuel — amber
  "#2FA37C", // routine — green
  "#C24A39", // service — red
  "#8A8A82", // admin — stone
  "#6E63C8", // other — violet
  "#3B6FA0", // blue
  "#B95C8A", // pink
  "#1F8A7A", // teal
  "#B86A1E", // orange
  "#5F6368", // grey
];

export function iconFor(name: string): LucideIcon {
  return ICON_MAP[name] ?? Tag;
}

export function CategoryIcon({
  category,
  className = "size-4",
}: {
  category: { color: string; icon: string } | null | undefined;
  className?: string;
}) {
  const Icon = iconFor(category?.icon ?? "Tag");
  return <Icon className={className} style={{ color: category?.color ?? "currentColor" }} />;
}

export function useCategories() {
  const fetchFn = useServerFn(listCategories);
  return useQuery<CategoryRow[]>({
    queryKey: ["categories"],
    queryFn: () => fetchFn() as Promise<CategoryRow[]>,
    staleTime: 60_000,
  });
}

export function categoryById(cats: CategoryRow[] | undefined, id: string | null | undefined) {
  if (!cats || !id) return undefined;
  return cats.find((c) => c.id === id);
}

// Pick the first category matching a role, falling back to the first of any
// role. Used for sensible defaults in OCR, import, and the "Add expense" form.
export function defaultForRole(
  cats: CategoryRow[] | undefined,
  role: CategoryRole,
): CategoryRow | undefined {
  if (!cats || cats.length === 0) return undefined;
  return cats.find((c) => c.role === role) ?? cats[0];
}

// Case-insensitive name match — used by CSV import and OCR mapping.
export function findCategoryByName(
  cats: CategoryRow[] | undefined,
  name: string,
): CategoryRow | undefined {
  if (!cats) return undefined;
  const target = name.trim().toLowerCase();
  if (!target) return undefined;
  return cats.find((c) => c.name.toLowerCase() === target);
}
