import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Receipt, TrendingUp, Menu, Warehouse, Settings, LogOut, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/lib/strings";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

const tabs = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/insights", label: "Insights", icon: TrendingUp },
] as const;

function AuthLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function openAddExpense() {
    if (pathname.startsWith("/expenses")) {
      window.dispatchEvent(new CustomEvent("revtab:add-expense"));
    } else {
      navigate({ to: "/expenses", hash: "add" });
    }
  }

  const HamburgerMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu">
          <Menu className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigate({ to: "/garage" })}>
          <Warehouse className="size-4 mr-2" /> {t.nav.garage}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
          <Settings className="size-4 mr-2" /> {t.nav.settings}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="size-4 mr-2" /> {t.nav.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen flex flex-col pb-24 md:pb-0 bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="inline-flex items-center gap-2">
            <div className="size-8 rounded-xl bg-primary grid place-items-center">
              <span className="font-display font-bold text-primary-foreground text-sm">R</span>
            </div>
            <span className="font-display font-semibold text-lg tracking-tight">{t.appName}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {tabs.map((tab) => {
              const active = pathname.startsWith(tab.to);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-1">
            <Button
              onClick={openAddExpense}
              size="sm"
              className="hidden md:inline-flex rounded-full"
            >
              <Plus className="size-4 mr-1" /> Add
            </Button>
            {HamburgerMenu}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Mobile bottom nav with center FAB */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20">
        <div className="bg-card/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-3 relative">
            {[tabs[0], tabs[1], tabs[2]].map((tab, idx) => {
              const Icon = tab.icon;
              const active = pathname.startsWith(tab.to);
              // Place FAB between Expenses and Insights — but we want it visually centered.
              // Use 3-col layout where middle col contains Expenses, and FAB floats above center.
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                  style={idx === 1 ? { paddingTop: "1.75rem" } : undefined}
                >
                  <Icon className="size-5" />
                  {tab.label}
                </Link>
              );
            })}
            <button
              onClick={openAddExpense}
              aria-label="Add expense"
              className="absolute left-1/2 -translate-x-1/2 -top-6 size-14 rounded-full bg-primary text-primary-foreground shadow-lg grid place-items-center active:scale-95 transition-transform"
            >
              <Plus className="size-6" />
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
