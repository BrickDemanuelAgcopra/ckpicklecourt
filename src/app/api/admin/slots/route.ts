import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { BookingError } from "@/lib/bookings";
import { setSlotOverride } from "@/lib/adminActions";
import { isValidISO } from "@/lib/time";

export const dynamic = "force-dynamic";

const Body = z.object({
  courtId: z.number().int(),
  date: z.string(),
  hours: z.array(z.number().int().min(0).max(23)).min(1),
  kind: z.enum(["closed"]).nullable(),
  reason: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!isValidISO(body.date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  try {
    for (const h of body.hours) await setSlotOverride(s.email, body.courtId, body.date, h, body.kind, body.reason);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
