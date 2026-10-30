import { NextResponse } from "next/server";
import { setSession, verifyAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`login:${ip}`, 8, 15 * 60_000)) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string") return NextResponse.json({ error: "bad" }, { status: 400 });
  const s = await verifyAdmin(email, password);
  if (!s) return NextResponse.json({ error: "invalid" }, { status: 401 });
  await setSession(s);
  await audit(s.email, "admin_login", "admin", s.email);
  return NextResponse.json({ ok: true });
}
