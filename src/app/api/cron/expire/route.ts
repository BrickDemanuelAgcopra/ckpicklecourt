import { NextResponse } from "next/server";
import { expireOverdueHolds } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/** Called every minute by the `cron` container (or any scheduler). Protected by CRON_SECRET when set. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const n = await expireOverdueHolds();
  return NextResponse.json({ expired: n });
}
