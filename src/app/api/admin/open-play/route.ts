import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { BookingError } from "@/lib/bookings";
import { setBookingStatus } from "@/lib/adminActions";
import { cancelOpenPlaySession, createOpenPlaySession } from "@/lib/openPlay";

export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create"),
    courtId: z.number().int(),
    date: z.string(),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
    pricePerPlayer: z.number().min(0),
    capacity: z.number().int().min(1).max(64),
    note: z.string().max(200).optional(),
  }),
  z.object({ op: z.literal("cancel"), id: z.number().int() }),
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
    if (body.op === "create") {
      const { courtId, date, startHour, endHour, pricePerPlayer, capacity, note } = body;
      const id = await createOpenPlaySession(s.email, { courtId, date, startHour, endHour, pricePerPlayer, capacity, note });
      return NextResponse.json({ ok: true, id });
    }
    const bookingIds = await cancelOpenPlaySession(s.email, body.id);
    // each player gets the usual cancellation email (it asks anyone who already paid to message the club)
    for (const id of bookingIds) await setBookingStatus(s.email, id, "cancel", "Open Play session cancelled").catch((e) => console.error("open play cancel", id, e));
    return NextResponse.json({ ok: true, cancelledBookings: bookingIds.length });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
