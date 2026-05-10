export const PLAN_LIMITS = {
  STARTER: {
    label: "Starter",
    priceMonthly: 59,
    maxTechnicians: 5,
    maxServiceAreas: 10,
    hasStats: false,
    hasEnterprise: false,
    hasApiAccess: false,
    color: "text-blue-400",
    borderColor: "border-blue-500/40",
    bgColor: "bg-blue-500/5",
    description: "Ιδανικό για μικρές επιχειρήσεις",
    features: [
      "Σελίδα SOS & QR Code",
      "Έως 5 τεχνικοί",
      "Έως 10 περιοχές εξυπηρέτησης",
      "Dashboard διαχείρισης",
      "Τεχνική εφαρμογή (mobile)",
    ],
    missing: ["Στατιστικά & αναλύσεις", "THR Wallets & Rewards", "API Access"],
  },
  PRO: {
    label: "Pro",
    priceMonthly: 149,
    maxTechnicians: 15,
    maxServiceAreas: 50,
    hasStats: true,
    hasEnterprise: false,
    hasApiAccess: false,
    color: "text-purple-400",
    borderColor: "border-purple-500/40",
    bgColor: "bg-purple-500/5",
    description: "Για επιχειρήσεις σε ανάπτυξη",
    features: [
      "Σελίδα SOS & QR Code",
      "Έως 15 τεχνικοί",
      "Έως 50 περιοχές εξυπηρέτησης",
      "Dashboard διαχείρισης",
      "Τεχνική εφαρμογή (mobile)",
      "Στατιστικά & αναλύσεις",
    ],
    missing: ["THR Wallets & Rewards", "API Access"],
  },
  ENTERPRISE: {
    label: "Enterprise",
    priceMonthly: 349,
    maxTechnicians: -1,
    maxServiceAreas: -1,
    hasStats: true,
    hasEnterprise: true,
    hasApiAccess: true,
    color: "text-amber-400",
    borderColor: "border-amber-500/40",
    bgColor: "bg-amber-500/5",
    description: "Πλήρης λύση χωρίς όρια",
    features: [
      "Απεριόριστοι τεχνικοί & περιοχές",
      "Όλα τα features",
      "Στατιστικά & αναλύσεις",
      "THR Wallets & Rewards για την ομάδα",
      "API Access",
      "Priority support",
    ],
    missing: [],
  },
} as const;

export type PlanKey = keyof typeof PLAN_LIMITS;
export const PLAN_KEYS: PlanKey[] = ["STARTER", "PRO", "ENTERPRISE"];

// Normalizes any casing ("starter", "pro", "ENTERPRISE") to the correct key.
export function getPlan(plan: string) {
  const key = plan.toUpperCase() as PlanKey;
  return PLAN_LIMITS[key] ?? PLAN_LIMITS.STARTER;
}

export function isUnlimited(n: number) {
  return n === -1;
}
