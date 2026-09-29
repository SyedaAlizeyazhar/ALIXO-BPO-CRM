import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_PATH } from "@/lib/config";
import { sessionFrom } from "@/lib/session";

const PUBLIC = ["/login", "/signup", "/api/auth/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const adminArea = pathname.startsWith(ADMIN_PATH + "/") || pathname.startsWith("/api/admin");

  // Hidden admin entrance: the login page itself is open; a signed-in admin skips to the portal.
  if (pathname === ADMIN_PATH) {
    const admin = await sessionFrom(req.cookies, "admin");
    return admin ? NextResponse.redirect(new URL(`${ADMIN_PATH}/portal`, req.url)) : NextResponse.next();
  }
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // The admin area only accepts the admin cookie, so an agent signed in in another tab doesn't matter.
  const session = await sessionFrom(req.cookies, adminArea ? "admin" : "any");
  if (!session) {
    if (isApi) return NextResponse.json({ error: adminArea ? "Admins only." : "Please log in again." }, { status: adminArea ? 403 : 401 });
    if (adminArea) return NextResponse.redirect(new URL(ADMIN_PATH, req.url));
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon|.*\\.(?:svg|png|jpg|ico|webp)$).*)"],
};
