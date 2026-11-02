import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, passphraseToken } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/login")) return NextResponse.next();

  const pass = process.env.APP_PASSPHRASE;
  if (!pass) {
    // Local dev without a passphrase is allowed; production never is.
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return NextResponse.redirect(new URL("/login?missing=1", req.url));
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await passphraseToken(pass))) return NextResponse.next();

  const url = new URL("/login", req.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
