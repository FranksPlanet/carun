import { Fuel, Wrench, Receipt, Tag, type LucideIcon } from "lucide-react";

export type Category = "fuel" | "service" | "admin" | "other";

export const CATEGORY_META: Record<
  Category,
  { label: string; color: string; icon: LucideIcon }
> = {
  fuel: { label: "Fuel", color: "#EF9F27", icon: Fuel },
  service: { label: "Service", color: "#1D9E75", icon: Wrench },
  admin: { label: "Admin", color: "#888780", icon: Receipt },
  other: { label: "Other", color: "#7F77DD", icon: Tag },
};

export const CATEGORIES: Category[] = ["fuel", "service", "admin", "other"];

export function CategoryIcon({
  category,
  className = "size-4",
}: {
  category: Category;
  className?: string;
}) {
  const Icon = CATEGORY_META[category].icon;
  return <Icon className={className} style={{ color: CATEGORY_META[category].color }} />;
}
