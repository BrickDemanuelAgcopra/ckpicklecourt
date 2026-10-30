import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { query } from "./db";

const COOKIE = "ck_admin";
const IDLE_MINUTES = Number(process.env.ADMIN_IDLE_MINUTES || 30);

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return new TextEncoder().encode(s);
}

/** owner = the ADMIN_EMAIL account from .env (full access incl. audit log and users); admin = everything else. */
export type AdminRole = "owner" | "admin";
export type AdminSession = { email: string; role: AdminRole };

export async function verifyAdmin(email: string, password: string): Promise<AdminSession | null> {
  const rows = await query<{ email: string; password_hash: string; role: string }>("SELECT email,password_hash,role FROM admin_users WHERE email=$1", [
    email.toLowerCase().trim(),
  ]);
  if (!rows.length) return null;
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  return ok ? { email: rows[0].email, role: rows[0].role === "owner" ? "owner" : "admin" } : null;
}

export async function setSession(s: AdminSession) {
  const token = await new SignJWT({ email: s.email, role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${IDLE_MINUTES}m`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: (process.env.SITE_URL || "").startsWith("https://"), path: "/", maxAge: IDLE_MINUTES * 60 });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    // Role comes from the database, not the cookie, so removing a user or changing a role takes effect at once.
    const rows = await query<{ role: string }>("SELECT role FROM admin_users WHERE email=$1", [String(payload.email)]);
    if (!rows.length) return null;
    return { email: String(payload.email), role: rows[0].role === "owner" ? "owner" : "admin" };
  } catch {
    return null;
  }
}

/** Sliding idle timeout: re-issue the cookie on every authenticated admin request. */
export async function touchSession(s: AdminSession) {
  try {
    await setSession(s);
  } catch {
    /* cookies() is read-only in some render contexts; ignore */
  }
}

export async function requireAdmin(): Promise<AdminSession> {
  const s = await getSession();
  if (!s) throw new Response("Unauthorized", { status: 401 });
  return s;
}
