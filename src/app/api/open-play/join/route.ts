import { NextResponse } from "next/server";
import { z } from "zod";
import { BookingError } from "@/lib/bookings";
import { createOpenPlayHold, MAX_PLAYERS_PER_JOIN } from "@/lib/openPlay";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const Body = z.object({
  sessionId: z.number().int(),
  players: z.number().int().min(1).max(MAX_PLAYERS_PER_JOIN),
  guestName: z.string().max(80),
  guestPhone: z.string().max(30),
  guestEmail: z.string().max(120).optional().default(""),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  // shares the court-booking bucket so one person can't sidestep the limit by alternating
  if (!rateLimit(`hold:${ip}`, 10, 10 * 60_000)) return NextResponse.json({ error: "Too many booking attempts. Please try again in a few minutes." }, { status: 429 });
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const r = await createOpenPlayHold(body);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.code === "conflict" ? 409 : 400 });
    console.error(e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
