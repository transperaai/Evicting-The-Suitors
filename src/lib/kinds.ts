// Soft pastel bubbles: `bg` fills the orb, `fg` is its text, `color` is the mid tone for dots and lines.
export const SUITOR_KINDS = {
  habit: { label: "Bad habit", bg: "#ffe4d1", fg: "#9a3d0a", color: "#f08a4b" },
  loop: { label: "Mindset loop", bg: "#d4f1f6", fg: "#0b5c6e", color: "#3bb3c9" },
  fear: { label: "Fear", bg: "#ebe2ff", fg: "#5530a8", color: "#8b6cf0" },
  lie: { label: "Limiting belief", bg: "#ffdde5", fg: "#9d1638", color: "#ee5d82" },
  sleep: { label: "Sleep", bg: "#dbe6ff", fg: "#1e3a99", color: "#5b7ff0" },
  inaction: { label: "No action / no plan", bg: "#eeeef1", fg: "#2f3138", color: "#9a9ca5" },
} as const;

export const HOUSEHOLD = { label: "The household", bg: "#fff0b8", fg: "#7a5200", color: "#f2c230" };
export const IDENTITY = { bg: "#e2f6cd", fg: "#2a5310", color: "#8fd36a" };

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

type Kind = { label: string; bg: string; fg: string; color: string };
const FALLBACK: Kind = SUITOR_KINDS.inaction;
const k = (kind: string): Kind => (SUITOR_KINDS as Record<string, Kind>)[kind] ?? FALLBACK;

export const kindColor = (kind: string) => k(kind).color;
export const kindLabel = (kind: string) => (kind in SUITOR_KINDS ? k(kind).label : kind);
export const kindStyle = (kind: string) => ({ bg: k(kind).bg, fg: k(kind).fg, color: k(kind).color });
