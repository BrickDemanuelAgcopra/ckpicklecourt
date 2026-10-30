import { NextResponse } from "next/server";
import { equipmentAvailable } from "@/lib/availability";
import { getEquipment } from "@/lib/config";
import { isValidISO } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const date = u.searchParams.get("date") || "";
  const hours = (u.searchParams.get("hours") || "").split(",").map(Number).filter((n) => Number.isInteger(n));
  if (!isValidISO(date)) return NextResponse.json({ available: {} });
  const items = await getEquipment();
  const available: Record<number, number> = {};
  for (const e of items) available[e.id] = await equipmentAvailable(date, hours, e.id, e.inventory_total);
  return NextResponse.json({ available }, { headers: { "cache-control": "no-store" } });
}
