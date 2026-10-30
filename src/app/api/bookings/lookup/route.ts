import { NextResponse } from "next/server";
import { findBookingsByName, getBookingByConfirmation } from "@/lib/bookings";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`lookup:${ip}`, 30, 60_000)) return NextResponse.json({ bookings: [] }, { status: 429 });
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ bookings: [] });
  const byId = await getBookingByConfirmation(q);
  if (byId) return NextResponse.json({ bookings: [byId] });
  const byName = await findBookingsByName(q);
  return NextResponse.json({ bookings: byName });
}
