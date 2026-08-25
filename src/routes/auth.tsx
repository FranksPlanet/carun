import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { t } from "@/lib/strings";
import { safeNextPath } from "@/lib/safe-redirect";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — RevTab" },
      { name: "description", content: "Sign in to RevTab to track your car's true cost per kilometre." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: safeNextPath(s.next),
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  // Preserve a same-origin return path (e.g. the OAuth consent screen) across sign-in.
  const returnTo = () => (next ? window.location.origin + next : window.location.origin);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !consent) {
      toast.error("Please agree to the Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: returnTo() },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      if (next) {
        window.location.href = next;
        return;
      }
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function oauth(provider: "google" | "apple") {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: returnTo(),
    });
    if (result.error) {
      toast.error(result.error.message ?? "Sign-in failed");
      return;
    }
    if (result.redirected) return;
    if (next) {
      window.location.href = next;
      return;
    }
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="size-9 rounded-md bg-primary/15 border border-primary/40 grid place-items-center">
              <span className="font-bold text-primary text-lg">R</span>
            </div>
            <span className="text-sm font-semibold">{t.appName}</span>
          </div>
          <h1 className="text-2xl font-semibold">{t.auth.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.auth.subtitle}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="email">{t.auth.email}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">{t.auth.password}</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {mode === "signup" && (
            <label className="flex items-start gap-2 text-sm pt-1">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                aria-label="Agree to the Privacy Policy"
              />
              <span>
                I agree to the{" "}
                <Link to="/privacy" target="_blank" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          )}
          <Button type="submit" className="w-full" disabled={loading || (mode === "signup" && !consent)}>
            {mode === "signin" ? t.auth.signIn : t.auth.signUp}
          </Button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">{t.auth.or}</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => oauth("google")}>
            {t.auth.google}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => oauth("apple")}>
            {t.auth.apple}
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === "signin" ? t.auth.needAccount : t.auth.haveAccount}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-primary hover:underline"
          >
            {mode === "signin" ? t.auth.signUp : t.auth.signIn}
          </button>
        </p>
      </div>
    </div>
  );
}
