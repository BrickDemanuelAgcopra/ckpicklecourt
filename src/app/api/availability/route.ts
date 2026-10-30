import { NextResponse } from "next/server";
import { getDayGrid } from "@/lib/availability";
import { expireOverdueHolds } from "@/lib/bookings";
import { isValidISO, todayISO } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") || todayISO();
  if (!isValidISO(date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  await expireOverdueHolds().catch(() => {});
  const grid = await getDayGrid(date);
  return NextResponse.json(grid, { headers: { "cache-control": "no-store" } });
}
