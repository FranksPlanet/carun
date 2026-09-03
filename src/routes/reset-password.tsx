import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { t } from "@/lib/strings";
import { validatePasswordPair, PASSWORD_MIN_LENGTH } from "@/lib/password";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — RevTab" },
      {
        name: "description",
        content: "Set a new RevTab password using the link from your reset email.",
      },
      { property: "og:title", content: "Choose a new password — RevTab" },
      {
        property: "og:description",
        content: "Set a new RevTab password using the link from your reset email.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // The recovery link carries its token in the URL fragment or as a ?code=,
  // which Supabase consumes on the client. Rendering on the server would only
  // flash an "invalid link" state before hydration.
  ssr: false,
  component: ResetPasswordPage,
});

type Phase = "checking" | "ready" | "invalid" | "done";

/** Strips any recovery token from the address bar without adding a history entry. */
function scrubUrl() {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", window.location.pathname);
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Supabase's client picks the recovery token out of the URL itself; we just
    // wait for the resulting session, then clear the URL either way.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        scrubUrl();
        setPhase("ready");
      }
    });

    (async () => {
      const hash = window.location.hash ?? "";
      const search = window.location.search ?? "";

      // Supabase reports a dead link via error params rather than an exception.
      if (/error(_code|_description)?=/.test(hash) || /[?&]error(_code|_description)?=/.test(search)) {
        scrubUrl();
        if (!cancelled) setPhase("invalid");
        return;
      }

      const code = new URLSearchParams(search).get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        scrubUrl();
        setPhase(exchangeError ? "invalid" : "ready");
        return;
      }

      // Implicit flow: the token arrives in the fragment and detectSessionInUrl
      // handles it, so poll briefly for the resulting session.
      for (let attempt = 0; attempt < 20; attempt++) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          scrubUrl();
          setPhase("ready");
          return;
        }
        if (!hash.includes("access_token")) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!cancelled) {
        scrubUrl();
        setPhase("invalid");
      }
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const check = validatePasswordPair(password, confirmation);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // Recovery sessions are exempt from the current-password requirement.
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPhase("done");
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-2xl font-semibold">Choose a new password</h1>
        </div>

        {phase === "checking" && (
          <p className="text-sm text-muted-foreground text-center">Checking your link…</p>
        )}

        {phase === "invalid" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              That reset link has expired or has already been used. Reset links are
              single-use and short-lived — request a fresh one and it'll work.
            </p>
            <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>
              Request a new link
            </Button>
          </div>
        )}

        {phase === "ready" && (
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                At least {PASSWORD_MIN_LENGTH} characters.
              </p>
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(e) => {
                  setConfirmation(e.target.value);
                  setError(null);
                }}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving…" : "Save new password"}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link to="/auth" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
