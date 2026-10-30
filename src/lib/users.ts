import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { query } from "./db";
import { audit } from "./audit";
import { BookingError } from "./bookings";

export type AdminUser = { id: number; email: string; role: "owner" | "admin"; created_at: string };

export async function listAdminUsers(): Promise<AdminUser[]> {
  return query<AdminUser>("SELECT id, email, role, created_at FROM admin_users ORDER BY role DESC, created_at");
}

/** Readable one-time password: no look-alike characters, grouped for reading aloud. */
function tempPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 12; i++) s += alphabet[randomInt(alphabet.length)];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

export async function addAdminUser(actor: string, email: string): Promise<string> {
  const e = email.toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new BookingError("Enter a valid email address");
  const exists = await query("SELECT 1 FROM admin_users WHERE email=$1", [e]);
  if (exists.length) throw new BookingError("That email already has an admin account");
  const pw = tempPassword();
  await query("INSERT INTO admin_users(email,password_hash,role) VALUES($1,$2,'admin')", [e, await bcrypt.hash(pw, 10)]);
  await audit(actor, "admin_user_added", "admin", e);
  return pw;
}

async function adminOnly(id: number): Promise<{ email: string }> {
  const rows = await query<{ email: string; role: string }>("SELECT email, role FROM admin_users WHERE id=$1", [id]);
  if (!rows.length) throw new BookingError("User not found");
  if (rows[0].role === "owner") throw new BookingError("The owner account is managed in the server .env file");
  return rows[0];
}

export async function resetAdminPassword(actor: string, id: number): Promise<string> {
  const u = await adminOnly(id);
  const pw = tempPassword();
  await query("UPDATE admin_users SET password_hash=$2 WHERE id=$1", [id, await bcrypt.hash(pw, 10)]);
  await audit(actor, "admin_password_reset", "admin", u.email);
  return pw;
}

export async function removeAdminUser(actor: string, id: number): Promise<void> {
  const u = await adminOnly(id);
  await query("DELETE FROM admin_users WHERE id=$1", [id]);
  await audit(actor, "admin_user_removed", "admin", u.email);
}

export async function changeOwnPassword(email: string, current: string, next: string): Promise<void> {
  const rows = await query<{ password_hash: string; role: string }>("SELECT password_hash, role FROM admin_users WHERE email=$1", [email]);
  if (!rows.length) throw new BookingError("Account not found");
  if (rows[0].role === "owner") throw new BookingError("The owner password is set by ADMIN_PASSWORD in the server .env file");
  if (!(await bcrypt.compare(current, rows[0].password_hash))) throw new BookingError("Current password is wrong");
  if (next.length < 10) throw new BookingError("Use at least 10 characters for the new password");
  await query("UPDATE admin_users SET password_hash=$2 WHERE email=$1", [email, await bcrypt.hash(next, 10)]);
  await audit(email, "admin_password_changed", "admin", email);
}
