import { NextResponse } from "next/server";
import { BookingError, cancelByGuest } from "@/lib/bookings";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await cancelByGuest(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Could not cancel" }, { status: 500 });
  }
}
