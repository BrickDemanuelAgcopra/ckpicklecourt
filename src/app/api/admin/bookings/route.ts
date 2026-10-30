import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { BookingError } from "@/lib/bookings";
import { createAdminBooking, deleteDirtyBookings, recordPayment, removeBookingHour, setBookingStatus } from "@/lib/adminActions";

export const dynamic = "force-dynamic";

const Payment = z.object({
  amount: z.number().positive().max(1_000_000),
  method: z.enum(["gcash", "cash", "bank", "other"]),
  reference: z.string().max(80).optional(),
  note: z.string().max(300).optional(),
});

const Body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("status"), id: z.string().uuid(), action: z.enum(["confirm", "confirm_partial", "settle", "decline", "cancel"]), note: z.string().max(500).optional() }),
  z.object({ op: z.literal("remove_hour"), id: z.string().uuid(), courtId: z.number().int(), hour: z.number().int() }),
  z.object({ op: z.literal("delete_dirty") }),
  z.object({ op: z.literal("pay"), id: z.string().uuid(), payment: Payment }),
  z.object({
    op: z.literal("create"),
    booking: z.object({
      date: z.string(),
      slots: z.array(z.object({ courtId: z.number().int(), hour: z.number().int().min(0).max(23) })).min(1).max(12),
      equipment: z.array(z.object({ equipmentId: z.number().int(), qty: z.number().int().min(0).max(50) })).default([]),
      guestName: z.string().max(120),
      guestPhone: z.string().max(40),
      guestEmail: z.string().max(160).optional(),
    }),
    payment: Payment.optional(),
    note: z.string().max(500).optional(),
  }),
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
    if (body.op === "status") return NextResponse.json({ booking: await setBookingStatus(s.email, body.id, body.action, body.note) });
    if (body.op === "remove_hour") {
      await removeBookingHour(s.email, body.id, body.courtId, body.hour);
      return NextResponse.json({ ok: true });
    }
    if (body.op === "pay") return NextResponse.json({ booking: await recordPayment(s.email, body.id, body.payment) });
    if (body.op === "create") return NextResponse.json({ booking: await createAdminBooking(s.email, body.booking, body.payment, body.note) });
    return NextResponse.json({ deleted: await deleteDirtyBookings(s.email) });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
