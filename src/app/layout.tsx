import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { TimeZoneCookie } from "@/components/TimeZoneCookie";
import { houseLight } from "@/lib/queries";
import { userTimeZone } from "@/lib/time";
import { stageFor } from "@/lib/stage";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Evicting the Suitors",
  description: "See what is occupying the house. Evict it. Fill the house with Jesus.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#10142a" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let light = 0;
  try {
    light = (await houseLight(await userTimeZone())).light;
  } catch {
    // No database yet: the page shows setup help.
  }
  return (
    <html lang="en" className={sans.variable} data-stage={stageFor(light)}>
      <body style={{ "--light": light.toFixed(3) } as React.CSSProperties}>
        <TimeZoneCookie />
        <Nav />
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
