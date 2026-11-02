import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

export function sql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. See README → Setup.");
  }
  client ??= neon(process.env.DATABASE_URL);
  return client;
}
