import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { BookingError } from "@/lib/bookings";
import { addAdminUser, changeOwnPassword, removeAdminUser, resetAdminPassword } from "@/lib/users";

export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), email: z.string().max(160) }),
  z.object({ op: z.literal("reset"), id: z.number().int() }),
  z.object({ op: z.literal("remove"), id: z.number().int() }),
  z.object({ op: z.literal("change_own"), current: z.string().max(200), next: z.string().max(200) }),
]);

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  try {
    if (body.op === "change_own") {
      await changeOwnPassword(s.email, body.current, body.next);
      return NextResponse.json({ ok: true });
    }
    // managing other accounts is owner-only
    if (s.role !== "owner") return NextResponse.json({ error: "Only the owner can manage users" }, { status: 403 });
    if (body.op === "add") return NextResponse.json({ password: await addAdminUser(s.email, body.email) });
    if (body.op === "reset") return NextResponse.json({ password: await resetAdminPassword(s.email, body.id) });
    await removeAdminUser(s.email, body.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
