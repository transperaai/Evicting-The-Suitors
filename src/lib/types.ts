export type Suitor = {
  id: number;
  name: string;
  kind: string;
  weight: number;
  status: "occupying" | "evicting" | "evicted";
  is_root: boolean;
  lie: string | null;
  sounds_like: string | null;
  cost: string | null;
  notes: string | null;
  created_at: string;
  evicted_at: string | null;
};

export type Occupant = {
  id: number;
  name: string;
  kind: "truth" | "practice";
  reference: string | null;
  content: string | null;
  rhythm: string;
  active: boolean;
};

export type Trigger = {
  id: number;
  suitor_id: number;
  description: string;
  location: string | null;
  time_of_day: string | null;
};

export type Note = {
  id: number;
  location: string;
  text: string;
  suitor_id: number | null;
  suitor_name?: string | null;
  placed_on: string;
  status: "planned" | "placed" | "removed";
};

export type Encounter = {
  id: number;
  suitor_id: number | null;
  suitor_name?: string | null;
  suitor_kind?: string | null;
  location: string | null;
  trigger_text: string | null;
  intensity: number;
  outcome: "gave_in" | "redirected" | "resisted";
  note_helped: string | null;
  reflection: string | null;
  occurred_at: string;
};

export type Day = {
  day: string;
  slept_at: string | null;
  woke_at: string | null;
  bedtime_target: string | null;
  plan1: string | null;
  plan2: string | null;
  plan3: string | null;
  handed_over: string | null;
  gratitude: string | null;
  reflection: string | null;
};
