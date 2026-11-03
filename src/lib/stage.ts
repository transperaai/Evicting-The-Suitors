// Night → Day. The house gets lighter as practices are kept and suitors are evicted.
export const STAGES = [
  { name: "Night", from: 0, line: "The house is dark. Every practice you keep lets light in.", swatch: "linear-gradient(180deg, #05060c, #10142a)", fg: "#a2a9c4" },
  { name: "Before dawn", from: 0.15, line: "The darkest part is behind you.", swatch: "linear-gradient(180deg, #0b1028, #28305f)", fg: "#c0c5e0" },
  { name: "Dawn", from: 0.35, line: "Light is breaking in.", swatch: "linear-gradient(180deg, #232655, #8a6aa6 70%, #e8a58f)", fg: "#fff" },
  { name: "Morning", from: 0.55, line: "The house is filling with light.", swatch: "linear-gradient(180deg, #8ea8e6, #f6d2bd)", fg: "#2f3656" },
  { name: "Day", from: 0.75, line: "Full daylight. Keep the house occupied.", swatch: "linear-gradient(180deg, #b8cdf5, #e4edff)", fg: "#3f4766" },
] as const;

export function stageFor(light: number) {
  let i = 0;
  STAGES.forEach((s, idx) => { if (light >= s.from) i = idx; });
  return i;
}
