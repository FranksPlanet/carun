import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { PASSWORD_MIN_LENGTH, validatePasswordPair } from "@/lib/password";

type Identities = { providers: string[]; email: string | null };

const PROVIDER_LABELS: Record<string, string> = {
  email: "Email and password",
  google: "Google",
  apple: "Apple",
};

async function loadIdentities(): Promise<Identities> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const user = data.user;
  const providers = (user?.identities ?? []).map((i) => i.provider);
  return { providers, email: user?.email ?? null };
}

export function SignInMethods() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["auth-identities"], queryFn: loadIdentities });

  const providers = q.data?.providers ?? [];
  const hasPassword = providers.includes("email");
  const others = providers.filter((p) => p !== "email");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const check = validatePasswordPair(next, confirm);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    if (hasPassword && current.length === 0) {
      setError("Enter your current password.");
      return;
    }

    setSaving(true);
    try {
      if (hasPassword) {
        // Real re-authentication. The backend ignores `current_password` on
        // updateUser (verified empirically), so we prove the current password
        // by actually authenticating with it — on a throwaway client that
        // never persists a session, so the signed-in session is untouched.
        const email = q.data?.email;
        if (!email) throw new Error("Could not confirm your account's email address.");
        const verifier = createClient(
          import.meta.env.VITE_SUPABASE_URL as string,
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
        );
        const { error: authError } = await verifier.auth.signInWithPassword({
          email,
          password: current,
        });
        await verifier.auth.signOut({ scope: "local" });
        if (authError) {
          setError("That current password isn't right.");
          return;
        }
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) throw updateError;

      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success(hasPassword ? "Password changed." : "Password added. You can now sign in with your email too.");
      await qc.invalidateQueries({ queryKey: ["auth-identities"] });
      await q.refetch();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      setError(raw || "Could not save your password. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="kpi-card space-y-3">
      <h2 className="font-semibold flex items-center gap-2">
        <KeyRound className="size-4" aria-hidden /> Sign-in methods
      </h2>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Checking your account…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">Couldn't read your sign-in methods.</p>
      ) : (
        <>
          <ul className="space-y-1">
            {providers.length === 0 && (
              <li className="text-sm text-muted-foreground">No sign-in methods found.</li>
            )}
            {providers.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm">
                <Check className="size-4 text-primary" aria-hidden />
                <span>{PROVIDER_LABELS[p] ?? p}</span>
                <span className="text-xs text-muted-foreground">active</span>
              </li>
            ))}
          </ul>

          <p className="text-sm text-muted-foreground">
            {hasPassword
              ? "Change the password you use with your email address."
              : others.length > 0
                ? `Add a password as an extra way in. Your ${others
                    .map((p) => PROVIDER_LABELS[p] ?? p)
                    .join(" and ")} sign-in keeps working exactly as it does now.`
                : "Add a password to sign in with your email address."}
          </p>

          <form onSubmit={onSubmit} className="space-y-3">
            {hasPassword && (
              <div>
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              </div>
            )}
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                value={next}
                onChange={(e) => setNext(e.target.value)}
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
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : hasPassword ? "Change password" : "Add a password"}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
