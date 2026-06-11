import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Receipt, TrendingUp, Menu, Warehouse, Settings, LogOut } from "lucide-react";
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
  { to: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
  { to: "/expenses", label: t.nav.expenses, icon: Receipt },
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
    <div className="min-h-screen flex flex-col pb-20 md:pb-0">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="inline-flex items-center gap-2">
            <div className="size-7 rounded-md bg-primary/15 border border-primary/40 grid place-items-center">
              <span className="font-display font-bold text-primary text-sm">R</span>
            </div>
            <span className="font-display uppercase tracking-widest text-xs">{t.appName}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {tabs.map((tab) => {
              const active = pathname.startsWith(tab.to);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`px-3 py-1.5 rounded-md text-xs font-display uppercase tracking-widest transition-colors ${
                    active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          {HamburgerMenu}
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur z-20">
        <div className="grid grid-cols-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] uppercase tracking-widest font-display ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
