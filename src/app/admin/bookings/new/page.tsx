import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { getConfig, getCourts, getEquipment, getRateBands } from "@/lib/config";
import { todayISO } from "@/lib/time";
import NewBookingForm from "@/components/admin/NewBookingForm";

export const dynamic = "force-dynamic";

export default async function NewBookingPage() {
  await requireAdminPage();
  const [cfg, courts, bands, equipment] = await Promise.all([getConfig(), getCourts(), getRateBands(), getEquipment()]);
  return (
    <>
      <p className="muted" style={{ marginBottom: 4 }}>
        <Link href="/admin/bookings">← Bookings</Link>
      </p>
      <h1>New booking</h1>
      <p className="muted" style={{ marginBottom: 14, maxWidth: 640 }}>
        For bookings taken by phone, Messenger or at the court. No booking fee is added. Record the GCash or cash payment here, or leave it unpaid and collect it later
        from the Bookings list.
      </p>
      <NewBookingForm
        today={todayISO()}
        sym={cfg.currencySymbol}
        courts={courts.filter((c) => c.available)}
        bands={bands}
        equipment={equipment}
      />
    </>
  );
}
