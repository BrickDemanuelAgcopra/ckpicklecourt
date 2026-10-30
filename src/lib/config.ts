import { query } from "./db";
import type { Court, Equipment, RateBand, SiteConfig } from "./types";

export async function getConfig(): Promise<SiteConfig> {
  const rows = await query<{ value: SiteConfig }>("SELECT value FROM settings WHERE key='config'");
  if (!rows.length) throw new Error("Config not seeded. Run `npm run db:seed`.");
  return rows[0].value;
}

export async function saveConfig(cfg: SiteConfig): Promise<void> {
  await query("INSERT INTO settings(key,value,updated_at) VALUES('config',$1,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()", [cfg]);
}

export async function getCourts(): Promise<Court[]> {
  return query<Court>("SELECT id,name,kind,available,sort FROM courts ORDER BY sort,id");
}

export async function getRateBands(): Promise<RateBand[]> {
  const rows = await query<RateBand & { price: string }>("SELECT id,name,start_hour,end_hour,price,days,sort FROM rate_bands ORDER BY sort,start_hour");
  return rows.map((r) => ({ ...r, price: Number(r.price) }));
}

export async function getEquipment(): Promise<Equipment[]> {
  const rows = await query<Equipment & { price: string }>("SELECT id,slug,name,unit,price,inventory_total,active FROM equipment WHERE active ORDER BY id");
  return rows.map((r) => ({ ...r, price: Number(r.price) }));
}
