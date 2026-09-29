import { jwtVerify, SignJWT } from "jose";

/* Signed session cookie. Kept free of Node-only imports so middleware can use it too. */

export type Session = { username: string; name: string; role: "agent" | "admin" };

/*
 * Agents and the admin use separate cookies, so an agent and the admin can be signed in
 * side by side in one browser (different tabs) without one replacing the other.
 */
export const SESSION_COOKIE = "alixo_session";
export const ADMIN_COOKIE = "alixo_admin";
export const cookieFor = (role: Session["role"]) => (role === "admin" ? ADMIN_COOKIE : SESSION_COOKIE);
export const SESSION_HOURS = 14;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters).");
  return new TextEncoder().encode(secret);
}

export async function signSession(s: Session) {
  return new SignJWT(s)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
}

/* Reads a token; `expect` rejects a token of the other role (e.g. an agent token in the admin cookie). */
export async function readSession(token: string | undefined, expect?: Session["role"]): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const { username, name, role } = payload as Partial<Session>;
    if (!username || !name || (role !== "agent" && role !== "admin")) return null;
    if (expect && role !== expect) return null;
    return { username, name, role };
  } catch {
    return null;
  }
}

type CookieReader = { get(name: string): { value: string } | undefined };

/*
 * "admin" → only the admin cookie. "any" → the agent if one is signed in here, otherwise the admin
 * (agent pages show the agent; the admin can still browse them when no agent is signed in).
 */
export async function sessionFrom(jar: CookieReader, scope: "admin" | "any"): Promise<Session | null> {
  const admin = await readSession(jar.get(ADMIN_COOKIE)?.value, "admin");
  if (scope === "admin") return admin;
  return (await readSession(jar.get(SESSION_COOKIE)?.value, "agent")) ?? admin;
}
