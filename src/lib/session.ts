import { jwtVerify, SignJWT } from "jose";

/* Signed session cookie. Kept free of Node-only imports so middleware can use it too. */

export type Session = { username: string; name: string; role: "agent" | "admin" };

export const SESSION_COOKIE = "alixo_session";
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

export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const { username, name, role } = payload as Partial<Session>;
    if (!username || !name || (role !== "agent" && role !== "admin")) return null;
    return { username, name, role };
  } catch {
    return null;
  }
}
