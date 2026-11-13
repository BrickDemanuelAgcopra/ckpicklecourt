import { requireAdminPage } from "@/lib/admin";
import { getConfig, getCourts } from "@/lib/config";
import { expireOverdueHolds } from "@/lib/bookings";
import { listOpenPlayAdmin } from "@/lib/openPlay";
import { todayISO } from "@/lib/time";
import OpenPlayAdmin from "@/components/admin/OpenPlayAdmin";

export const dynamic = "force-dynamic";

export default async function AdminOpenPlayPage() {
  await requireAdminPage();
  await expireOverdueHolds().catch(() => {});
  const today = todayISO();
  const [cfg, courts, sessions] = await Promise.all([getConfig(), getCourts(), listOpenPlayAdmin(today)]);
  return (
    <>
      <h1>Open Play</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Schedule a session on a court and players can join it from the booking grid, paying per player. Their receipts arrive in Bookings like any other booking, so review and confirm them there.
      </p>
      <OpenPlayAdmin today={today} sym={cfg.currencySymbol} courts={courts.filter((c) => c.available)} sessions={sessions} />
    </>
  );
}
