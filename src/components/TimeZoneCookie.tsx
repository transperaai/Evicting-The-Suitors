"use client";
import { useEffect } from "react";

/** Tells the server which time zone "today" is in. */
export function TimeZoneCookie() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && !document.cookie.includes(`tz=${encodeURIComponent(tz)}`)) {
        document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      }
    } catch {}
  }, []);
  return null;
}
