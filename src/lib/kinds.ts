export const SUITOR_KINDS = {
  habit: { label: "Bad habit", color: "#d9622b" },
  loop: { label: "Mindset loop", color: "#22a699" },
  fear: { label: "Fear", color: "#8b5cf6" },
  lie: { label: "Limiting belief", color: "#e11d48" },
  sleep: { label: "Sleep", color: "#4f6bed" },
  inaction: { label: "No action / no plan", color: "#7c8798" },
} as const;

export type SuitorKind = keyof typeof SUITOR_KINDS;

export const STATUSES = {
  occupying: "Occupying",
  evicting: "Being evicted",
  evicted: "Evicted",
} as const;

export const RHYTHMS = {
  evening: "Evening",
  morning: "Morning",
  daily: "Through the day",
  moment: "In the moment",
} as const;

export const OUTCOMES = {
  gave_in: "Gave in",
  redirected: "Redirected",
  resisted: "Resisted",
} as const;

export const GOLD = "#f5c451";

export function kindColor(kind: string) {
  return (SUITOR_KINDS as Record<string, { color: string }>)[kind]?.color ?? "#7c8798";
}
export function kindLabel(kind: string) {
  return (SUITOR_KINDS as Record<string, { label: string }>)[kind]?.label ?? kind;
}
