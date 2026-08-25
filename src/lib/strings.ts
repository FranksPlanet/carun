// Shared UI copy for auth, onboarding, navigation and empty states.
// This is not the single source of all user-facing text: most components
// hardcode their own copy inline. Only the keys below are shared/reused.
export const t = {
  appName: "RevTab",

  nav: {
    expenses: "Expenses",
    garage: "Garage",
    settings: "Settings",
    signOut: "Sign out",
  },

  auth: {
    title: "Welcome to RevTab",
    subtitle: "Track every kilometre your car costs you.",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signUp: "Create account",
    or: "or",
    google: "Continue with Google",
    apple: "Continue with Apple",
    needAccount: "Don't have an account?",
    haveAccount: "Already have an account?",
  },

  onboarding: {
    framing: "Rough answers are fine — estimates sharpen as you log real data.",
    step: (n: number, total: number) => `Step ${n} of ${total}`,
    next: "Next",
    back: "Back",
    finish: "Finish",
    skip: "Skip",

    basicsTitle: "Car basics",
    purchaseTitle: "When you got it",
    purchaseHint:
      "This sets the window of pre-tracking history we'll estimate for you.",
    repairsTitle: "Big repairs you remember",
    repairsHint:
      "Everyday running costs get extrapolated automatically. Big one-off repairs are never guessed — only what you remember is counted.",
    recurringTitle: "Yearly costs",
    doneTitle: "You're set",
    doneBody: "Add your first expense to start sharpening the numbers.",
  },

  kpi: {
    costPerKm: "Cost per kilometre driven",
  },

  empty: {
    noVehicles: "No cars yet. Add one to get started.",
    noExpenses: "No expenses logged yet. Add one to see your cost per km.",
    needFuel:
      "Log at least two full-tank fill-ups with litres to see consumption.",
  },

  est: "≈ est",
} as const;
