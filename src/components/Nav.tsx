"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/", "The Hall"],
  ["/suitors", "Suitors"],
  ["/household", "Household"],
  ["/rooms", "Rooms"],
  ["/rhythm", "Rhythm"],
  ["/log", "Log"],
] as const;

export function Nav() {
  const path = usePathname();
  if (path.startsWith("/login")) return null;
  return (
    <nav className="nav">
      <Link href="/" className="brand">Evicting the Suitors</Link>
      <div className="nav-links">
        {LINKS.map(([href, label]) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link key={href} href={href} className={active ? "active" : undefined}>{label}</Link>
          );
        })}
        <Link href="/loop" className={`loop-link${path.startsWith("/loop") ? " active" : ""}`}>I&rsquo;m in a loop</Link>
      </div>
    </nav>
  );
}
