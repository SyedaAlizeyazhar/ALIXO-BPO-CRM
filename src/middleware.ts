import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_PATH } from "@/lib/config";
import { readSession, SESSION_COOKIE } from "@/lib/session";

const PUBLIC = ["/login", "/signup", "/api/auth/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  const isApi = pathname.startsWith("/api/");

  // Hidden admin entrance: the login page itself is open; an admin skips straight to the portal.
  if (pathname === ADMIN_PATH) {
    return session?.role === "admin" ? NextResponse.redirect(new URL(`${ADMIN_PATH}/portal`, req.url)) : NextResponse.next();
  }
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const adminOnly = pathname.startsWith(ADMIN_PATH + "/") || pathname.startsWith("/api/admin");
  if (!session) {
    if (isApi) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
    if (adminOnly) return NextResponse.redirect(new URL(ADMIN_PATH, req.url));
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (adminOnly && session.role !== "admin") {
    return isApi ? NextResponse.json({ error: "Admins only." }, { status: 403 }) : NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon|.*\\.(?:svg|png|jpg|ico|webp)$).*)"],
};
