import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { TimeZoneCookie } from "@/components/TimeZoneCookie";
import { houseLight } from "@/lib/queries";
import { userTimeZone } from "@/lib/time";

export const metadata: Metadata = {
  title: "Evicting the Suitors",
  description: "See what is occupying the house. Evict it. Fill the house with Jesus.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0b0a09", colorScheme: "dark" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let light = 0;
  try {
    light = (await houseLight(await userTimeZone())).light;
  } catch {
    // No database yet — the house stays dark and the page shows setup help.
  }
  return (
    <html lang="en">
      <body style={{ "--light": light.toFixed(3) } as React.CSSProperties}>
        <TimeZoneCookie />
        <Nav />
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
