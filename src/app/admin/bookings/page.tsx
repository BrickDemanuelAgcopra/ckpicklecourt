import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { listBookings } from "@/lib/adminActions";
import { getConfig } from "@/lib/config";
import { expireOverdueHolds } from "@/lib/bookings";
import BookingsTable from "@/components/admin/BookingsTable";

export const dynamic = "force-dynamic";

const VIEWS = [
  ["review", "Needs review"],
  ["upcoming", "Upcoming"],
  ["all", "All bookings"],
  ["abandoned", "Abandoned checkouts"],
] as const;

export default async function AdminBookings({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  await requireAdminPage();
  await expireOverdueHolds().catch(() => {});
  const sp = await searchParams;
  const view = (VIEWS.find((v) => v[0] === sp.view)?.[0] ?? "review") as (typeof VIEWS)[number][0];
  const [cfg, bookings] = await Promise.all([getConfig(), listBookings(view, sp.q)]);
  return (
    <>
      <h1>Bookings</h1>
      <div className="tabs">
        {VIEWS.map(([k, l]) => (
          <Link key={k} href={`/admin/bookings?view=${k}`} className={k === view ? "active" : ""}>
            {l}
          </Link>
        ))}
        <form style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <input type="hidden" name="view" value={view} />
          <input name="q" defaultValue={sp.q || ""} placeholder="Search name, ref or phone" style={{ border: "1px solid var(--ck-line)", borderRadius: 999, padding: "6px 12px", fontSize: 13 }} />
          <button className="btn btn-outline btn-sm">Search</button>
        </form>
      </div>
      {view === "abandoned" && (
        <div className="note">
          Holds that never got a receipt. Most are abandoned checkouts; a few may be guests mid-payment right now. Expired ones older than a day can be cleaned up with <b>Delete dirty bookings</b>.
        </div>
      )}
      <BookingsTable bookings={bookings} sym={cfg.currencySymbol} view={view} partialEnabled={cfg.partialPaymentEnabled} />
    </>
  );
}
