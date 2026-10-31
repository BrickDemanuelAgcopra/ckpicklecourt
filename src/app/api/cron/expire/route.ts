import { NextResponse } from "next/server";
import { expireOverdueHolds } from "@/lib/bookings";
import { runScheduledEmails } from "@/lib/scheduledEmails";

export const dynamic = "force-dynamic";

/** Called every minute by the `cron` container (or any scheduler). Protected by CRON_SECRET when set. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const n = await expireOverdueHolds();
  // day-before reminders and the owner's morning summary ride on the same every-minute tick
  const emails = await runScheduledEmails().catch((e) => {
    console.error("scheduled emails failed", e);
    return null;
  });
  return NextResponse.json({ expired: n, emails });
}
