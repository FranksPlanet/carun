import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listVehiclesTool from "./tools/list-vehicles";
import listCategoriesTool from "./tools/list-categories";
import listExpensesTool from "./tools/list-expenses";
import addExpenseTool from "./tools/add-expense";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged and Vite inlines it at build time.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "revtab-tracker",
  title: "RevTab Tracker",
  version: "0.1.0",
  instructions:
    "Tools for RevTab, a car running-cost tracker. Use list_vehicles to find the user's cars, list_categories for expense categories, list_expenses to read spending history, and add_expense to log a new cost. All money values are in minor currency units.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listVehiclesTool, listCategoriesTool, listExpensesTool, addExpenseTool],
});
