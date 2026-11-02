export const AUTH_COOKIE = "ets_key";

export async function passphraseToken(passphrase: string) {
  const data = new TextEncoder().encode(`evicting-the-suitors:${passphrase}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
