import { requireAdminPage } from "@/lib/admin";
import { query } from "@/lib/db";
import { getRateBands } from "@/lib/config";
import { bandHours, bandsForDate } from "@/lib/availability";
import { isValidISO, todayISO } from "@/lib/time";
import EquipmentAdmin from "@/components/admin/EquipmentAdmin";
import type { Equipment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EquipmentPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const date = sp.date && isValidISO(sp.date) ? sp.date : todayISO();
  const items = (await query<Equipment & { price: string }>("SELECT id,slug,name,unit,price,inventory_total,active FROM equipment ORDER BY id")).map((r) => ({ ...r, price: Number(r.price) }));
  const bands = bandsForDate(await getRateBands(), date);
  const hours = bands.flatMap(bandHours);
  const usage = await query<{ equipment_id: number; hour: number; qty: number }>("SELECT equipment_id, hour, qty FROM equipment_walkin_usage WHERE date=$1", [date]);
  const rented = await query<{ equipment_id: number; hour: number; qty: string }>(
    `SELECT equipment_id, hour, SUM(qty) AS qty FROM (
       SELECT DISTINCT e.equipment_id, s.hour, b.id, e.qty FROM booking_equipment e
         JOIN bookings b ON b.id=e.booking_id JOIN booking_slots s ON s.booking_id=b.id
        WHERE s.date=$1 AND b.status IN ('awaiting_payment','pending','confirmed','balance_due')) x GROUP BY equipment_id, hour`,
    [date]
  );
  return (
    <>
      <h1>Equipment</h1>
      <EquipmentAdmin items={items} date={date} hours={hours} usage={usage} rented={rented.map((r) => ({ ...r, qty: Number(r.qty) }))} />
    </>
  );
}
