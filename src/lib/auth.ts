import "server-only";

import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { HttpError } from "./errors";
import { readSession, SESSION_COOKIE, SESSION_HOURS, signSession, type Session } from "./session";
import { StoreNotConfigured } from "./store";

export async function getSession() {
  const jar = await cookies();
  return readSession(jar.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(res: NextResponse, s: Session) {
  res.cookies.set(SESSION_COOKIE, await signSession(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export const clearSessionCookie = (res: NextResponse) => res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });

export const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/* Wraps a route handler: requires a session (optionally admin) and turns thrown errors into JSON. */
export function guarded<T extends unknown[]>(
  handler: (session: Session, ...args: T) => Promise<Response>,
  opts: { admin?: boolean } = {},
) {
  return async (...args: T) => {
    const session = await getSession();
    if (!session) return fail("Please log in again.", 401);
    if (opts.admin && session.role !== "admin") return fail("Admins only.", 403);
    try {
      return await handler(session, ...args);
    } catch (e) {
      return fail((e as Error).message, e instanceof HttpError ? e.status : e instanceof StoreNotConfigured ? 503 : 502);
    }
  };
}

/* Constant-time check of the admin password (ADMIN_PASSWORD). */
export function adminPasswordOk(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !password) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
