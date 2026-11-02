import { cookies } from "next/headers";

export async function userTimeZone() {
  const tz = (await cookies()).get("tz")?.value;
  const candidate = tz || process.env.APP_TIMEZONE || "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate });
    return candidate;
  } catch {
    return "UTC";
  }
}

/** YYYY-MM-DD for "now" in the user's time zone */
export function todayIn(tz: string, offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** YYYY-MM-DDTHH:MM for a datetime-local input, in the user's time zone */
export function nowLocalInput(tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function formatWhen(d: Date | string, tz: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  }).format(new Date(d));
}

export function formatDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

/** Hours between a bedtime and wake time ("23:30:00", "07:15:00") */
export function sleepHours(slept?: string | null, woke?: string | null) {
  if (!slept || !woke) return null;
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  let diff = toMin(woke) - toMin(slept);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 10) / 10;
}

export function hhmm(t?: string | null) {
  return t ? t.slice(0, 5) : "";
}
