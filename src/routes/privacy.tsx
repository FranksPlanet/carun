import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicTopBar } from "@/components/public-top-bar";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — RevTab" },
      {
        name: "description",
        content: "How RevTab collects, stores, and protects your car data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-background">
      <PublicTopBar />
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <div>
          <Link to="/" className="text-sm text-primary hover:underline">
            ← Back to RevTab
          </Link>
          <h1 className="text-3xl font-semibold mt-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Placeholder wording — must be reviewed by a human (and ideally a lawyer) before launch.
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">What we collect</h2>
          <p className="text-sm">
            RevTab stores the data you enter yourself: cars (name, plate, fuel type,
            purchase date, odometer, price), expenses (date, amount, category, quantity,
            notes, tags), past repairs, recurring yearly costs, and reminders. You may
            optionally upload receipt images and car photos.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Why we collect it</h2>
          <p className="text-sm">
            We use this data only to show you your own cost-per-kilometre, consumption,
            and projections inside the app. We do not sell it, share it with advertisers,
            or use it to train AI models.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Where it's stored</h2>
          <p className="text-sm">
            Your data lives in a managed Supabase Postgres database and Supabase Storage,
            protected by row-level security so only your account can read or modify it.
            Receipt-scanning uses an AI service to read text from images you upload — the
            image is sent securely, processed, and the structured result returned to you.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Export and deletion</h2>
          <p className="text-sm">
            You can export everything you've entered as a JSON file at any time from
            Settings → "Export all my data". You can also permanently delete your account
            and all related data from Settings → "Delete account and all data". Deletion
            is immediate and cannot be undone.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="text-sm">
            Questions or requests? Email <a className="text-primary hover:underline" href="mailto:privacy@revtab.app">privacy@revtab.app</a>.
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-6 border-t border-border">
          Last updated: placeholder. Replace this entire document with reviewed wording
          before public launch.
        </p>
      </div>
    </div>
  );
}
