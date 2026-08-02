import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Warehouse, Settings as SettingsIcon, Shield, Mail, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { t } from "@/lib/strings";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: {} });
    return { user: data.user };
  },
  component: AuthLayout,
});

const topLinks = [
  { to: "/expenses", label: "Expenses" },
  { to: "/insights", label: "Insights" },
] as const;

function AuthLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: {}, replace: true });
  }

  function openAddExpense() {
    if (pathname.startsWith("/expenses")) {
      window.dispatchEvent(new CustomEvent("revtab:add-expense"));
    } else {
      navigate({ to: "/expenses", hash: "add" });
    }
  }

  function go(to: string) {
    setMenuOpen(false);
    navigate({ to });
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      {/* Top app bar — ink, fills the notch / status-bar area */}
      <header
        className="sticky top-0 z-30 bg-[#16150F] text-white"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto max-w-3xl px-3 sm:px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 min-h-14">
          {/* Brand: acid dot + wordmark in Instrument Serif */}
          <Link
            to="/dashboard"
            className="flex items-center gap-2 mr-auto min-w-0"
            aria-label="RevTab — go to dashboard"
          >
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-full bg-[#C8F031] shrink-0"
            />
            <span className="font-display text-2xl leading-none tracking-tight text-white truncate">
              {t.appName}
            </span>
          </Link>

          {/* Right: text nav + MENU button */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {topLinks.map((l) => {
              const active = pathname.startsWith(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#C8F031] text-[#16150F]"
                      : "text-white/65 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="ml-1 px-3 py-1.5 rounded-full border border-white/70 bg-transparent text-sm font-semibold tracking-wide text-white hover:bg-white/10 transition-colors"
                  aria-label="Open menu"
                >
                  MENU
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 sm:w-80">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col">
                  <MenuLink onClick={() => go("/garage")} icon={<Warehouse className="size-4" />} label="Garage" />
                  <MenuLink onClick={() => go("/settings")} icon={<SettingsIcon className="size-4" />} label="Settings" />
                  <MenuLink onClick={() => go("/privacy")} icon={<Shield className="size-4" />} label="Privacy" />
                  <MenuLink onClick={() => go("/contact")} icon={<Mail className="size-4" />} label="Contact" />
                  <div className="my-2 border-t border-border" />
                  <MenuLink
                    onClick={() => {
                      setMenuOpen(false);
                      void signOut();
                    }}
                    icon={<LogOut className="size-4" />}
                    label={t.nav.signOut}
                  />
                </nav>
              </SheetContent>
            </Sheet>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Bottom: single full-width primary Add expense button */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background/95 to-transparent pt-3 px-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto max-w-3xl">
          <Button
            onClick={openAddExpense}
            size="lg"
            variant="accent"
            className="w-full h-14 text-base font-semibold rounded-sm shadow-lg"
          >
            <Plus className="size-5 mr-2" /> Add expense
          </Button>
        </div>
      </div>
    </div>
  );
}

function MenuLink({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 px-2 py-3 rounded-md text-left text-base font-medium text-foreground hover:bg-secondary transition-colors"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </button>
  );
}
