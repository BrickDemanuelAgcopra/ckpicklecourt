import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isValidISO } from "@/lib/time";

export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("save_item"), id: z.number().int().optional(), name: z.string().min(1).max(60), unit: z.string().min(1).max(30), price: z.number().min(0), inventoryTotal: z.number().int().min(0), active: z.boolean().default(true) }),
  z.object({ op: z.literal("walkin"), date: z.string(), equipmentId: z.number().int(), hour: z.number().int().min(0).max(23), qty: z.number().int().min(0) }),
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
  if (body.op === "save_item") {
    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (body.id) await query("UPDATE equipment SET name=$2, unit=$3, price=$4, inventory_total=$5, active=$6 WHERE id=$1", [body.id, body.name, body.unit, body.price, body.inventoryTotal, body.active]);
    else await query("INSERT INTO equipment(slug,name,unit,price,inventory_total,active) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, unit=EXCLUDED.unit, price=EXCLUDED.price, inventory_total=EXCLUDED.inventory_total, active=EXCLUDED.active", [slug, body.name, body.unit, body.price, body.inventoryTotal, body.active]);
    await audit(s.email, "settings_updated", "equipment", body.id ?? slug, body);
    return NextResponse.json({ ok: true });
  }
  if (!isValidISO(body.date)) return NextResponse.json({ error: "bad date" }, { status: 400 });
  await query("INSERT INTO equipment_walkin_usage(date,equipment_id,hour,qty) VALUES($1,$2,$3,$4) ON CONFLICT (date,equipment_id,hour) DO UPDATE SET qty=EXCLUDED.qty", [body.date, body.equipmentId, body.hour, body.qty]);
  await audit(s.email, "walkin_usage_saved", "equipment", body.equipmentId, body);
  return NextResponse.json({ ok: true });
}
