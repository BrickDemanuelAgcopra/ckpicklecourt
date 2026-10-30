import { NextResponse } from "next/server";
import { z } from "zod";
import { BookingError, createHold } from "@/lib/bookings";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const Body = z.object({
  date: z.string(),
  slots: z.array(z.object({ courtId: z.number().int(), hour: z.number().int().min(0).max(23) })).min(1).max(12),
  equipment: z.array(z.object({ equipmentId: z.number().int(), qty: z.number().int().min(0).max(20) })).default([]),
  guestName: z.string().max(80),
  guestPhone: z.string().max(30),
  guestEmail: z.string().max(120).optional().default(""),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`hold:${ip}`, 10, 10 * 60_000)) return NextResponse.json({ error: "Too many booking attempts. Please try again in a few minutes." }, { status: 429 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const r = await createHold(body);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "conflict" ? 409 : 400 });
    console.error(e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
