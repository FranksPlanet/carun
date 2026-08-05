// Centralized UI copy. All user-facing strings live here so a second language
// can be added later without touching components.
export const t = {
  appName: "RevTab",
  tagline: "Know what every kilometre really costs.",

  nav: {
    dashboard: "Dashboard",
    expenses: "Expenses",
    fuel: "Fuel",
    projection: "Projection",
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
    trackedDistance: "Tracked distance",
    avgConsumption: "Avg consumption",
    loggedTotal: "Logged total",
    estimatedLifetime: "Estimated lifetime cost so far",
    fillUps: "Fill-ups",
    cleanAvg: "Clean avg",
    loadedAvg: "Loaded avg",
    crossoverYear: "Crossover year",
    perYearRunning: "Per-year running",
    totalOverHorizon: "Total over horizon",
    modelledFuel: "Modelled fuel Kč/km",
  },

  empty: {
    noVehicles: "No cars yet. Add one to get started.",
    noExpenses: "No expenses logged yet. Add one to see your cost per km.",
    needFuel:
      "Log at least two full-tank fill-ups with litres to see consumption.",
    noReminders: "No reminders set.",
    noRecurring: "No yearly costs added yet.",
    noRepairs: "No remembered repairs.",
  },

  est: "≈ est",
} as const;
