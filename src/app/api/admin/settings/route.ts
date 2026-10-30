import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getConfig, saveConfig } from "@/lib/config";
import { query } from "@/lib/db";
import { audit } from "@/lib/audit";
import { saveUpload } from "@/lib/storage";
import type { SiteConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

const Titled = z.array(z.object({ id: z.string(), title: z.string(), text: z.string() }));
const ConfigPatch = z.object({
  courtName: z.string().min(1).max(80),
  tagline: z.string().max(80),
  locationText: z.string().max(200),
  mapsUrl: z.string().max(300),
  contactNumber: z.string().max(40),
  emailAddress: z.string().max(120),
  facebookPage: z.string().max(200),
  openingHoursText: z.string().max(80),
  bookingWindowDays: z.number().int().min(1).max(365),
  bookingFee: z.number().min(0),
  bookingFeePerHour: z.boolean(),
  paymentWindowMinutes: z.number().int().min(1).max(120),
  partialPaymentEnabled: z.boolean(),
  partialPaymentPercent: z.number().int().min(1).max(99),
  emailSendingEnabled: z.boolean(),
  adminEmail: z.string().max(120),
  showRateSeparators: z.boolean(),
  payment: z.object({ bankName: z.string().max(60), accountName: z.string().max(100), accountNumber: z.string().max(60), qrUrl: z.string().max(300) }),
  paymentAlt: z.object({ bankName: z.string().max(60), accountName: z.string().max(100), accountNumber: z.string().max(60), qrUrl: z.string().max(300) }).optional(),
  courtDetails: Titled,
  policies: Titled,
  faqs: z.array(z.object({ q: z.string(), a: z.string() })),
  gallery: z.array(z.string().max(300)).max(12),
});

const Body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("config"), config: ConfigPatch }),
  z.object({ op: z.literal("courts"), courts: z.array(z.object({ id: z.number().int().optional(), name: z.string().min(1).max(40), kind: z.string().max(20), available: z.boolean() })).min(1).max(20) }),
  z.object({ op: z.literal("bands"), bands: z.array(z.object({ name: z.string().max(40), start_hour: z.number().int().min(0).max(23), end_hour: z.number().int().min(1).max(24), price: z.number().min(0), days: z.array(z.number().int().min(0).max(6)) })).max(12) }),
]);

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    // image uploads: payment QR or logo
    const fd = await req.formData();
    const kind = String(fd.get("kind") || "");
    const file = fd.get("file");
    if (!(file instanceof File) || !["qr", "qr2", "logo"].includes(kind)) return NextResponse.json({ error: "bad upload" }, { status: 400 });
    try {
      const rel = await saveUpload("public", file);
      const cfg = await getConfig();
      if (kind === "qr") cfg.payment.qrUrl = `/api/files/${rel}`;
      else if (kind === "qr2") cfg.paymentAlt = { bankName: "Maya", accountName: cfg.payment.accountName, accountNumber: "", ...cfg.paymentAlt, qrUrl: `/api/files/${rel}` };
      else cfg.logoUrl = `/api/files/${rel}`;
      await saveConfig(cfg);
      await audit(s.email, "settings_updated", "config", kind, { file: rel });
      return NextResponse.json({ ok: true, url: `/api/files/${rel}` });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "upload failed" }, { status: 400 });
    }
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "Invalid settings: " + (e instanceof Error ? e.message.slice(0, 200) : "") }, { status: 400 });
  }
  if (body.op === "config") {
    const cur = await getConfig();
    const next: SiteConfig = { ...cur, ...body.config, payment: { ...cur.payment, ...body.config.payment } };
    await saveConfig(next);
    await audit(s.email, "settings_updated", "config", "config");
    return NextResponse.json({ ok: true });
  }
  if (body.op === "courts") {
    const keep: number[] = [];
    let i = 0;
    for (const c of body.courts) {
      i++;
      if (c.id) {
        await query("UPDATE courts SET name=$2, kind=$3, available=$4, sort=$5 WHERE id=$1", [c.id, c.name, c.kind, c.available, i]);
        keep.push(c.id);
      } else {
        const r = await query<{ id: number }>("INSERT INTO courts(name,kind,available,sort) VALUES($1,$2,$3,$4) RETURNING id", [c.name, c.kind, c.available, i]);
        keep.push(r[0].id);
      }
    }
    // courts with history are never deleted, only hidden
    await query("UPDATE courts SET available=false WHERE NOT (id = ANY($1::int[]))", [keep]);
    await audit(s.email, "settings_updated", "courts", null, body.courts);
    return NextResponse.json({ ok: true });
  }
  await query("DELETE FROM rate_bands");
  let i = 0;
  for (const b of body.bands) {
    if (b.end_hour <= b.start_hour) return NextResponse.json({ error: "A band must end after it starts" }, { status: 400 });
    await query("INSERT INTO rate_bands(name,start_hour,end_hour,price,days,sort) VALUES($1,$2,$3,$4,$5,$6)", [b.name, b.start_hour, b.end_hour, b.price, b.days, ++i]);
  }
  await audit(s.email, "settings_updated", "rate_bands", null, body.bands);
  return NextResponse.json({ ok: true });
}
