import { requireAdminPage } from "@/lib/admin";
import { getConfig } from "@/lib/config";
import { getDayGrid } from "@/lib/availability";
import { isValidISO, todayISO } from "@/lib/time";
import AdminGrid from "@/components/admin/AdminGrid";

export const dynamic = "force-dynamic";

export default async function AdminGridPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const date = sp.date && isValidISO(sp.date) ? sp.date : todayISO();
  const [cfg, grid] = await Promise.all([getConfig(), getDayGrid(date)]);
  return (
    <>
      <h1>Court grid</h1>
      <p className="muted" style={{ marginBottom: 12 }}>Tap open hours to select them, then close them (maintenance, private events, rain). Tap closed hours to reopen. Booked hours show the guest&apos;s initials.</p>
      <AdminGrid grid={grid} sym={cfg.currencySymbol} />
    </>
  );
}
