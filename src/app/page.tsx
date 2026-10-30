import Splash from "@/components/Splash";
import Hero from "@/components/Hero";
import BookingWidget from "@/components/BookingWidget";
import PublicShell from "@/components/PublicShell";
import { CourtInfo, OpenPlayBanner, Rates } from "@/components/Sections";
import { getConfig, getEquipment, getRateBands } from "@/lib/config";
import { getDayGrid } from "@/lib/availability";
import { expireOverdueHolds } from "@/lib/bookings";
import { todayISO } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Home() {
  await expireOverdueHolds().catch(() => {});
  const today = todayISO();
  const [cfg, bands, equipment, grid] = await Promise.all([getConfig(), getRateBands(), getEquipment(), getDayGrid(today)]);
  const openPlay = await hasOpenPlay();
  return (
    <>
      <Splash name={cfg.courtName} logoUrl={cfg.logoUrl} />
      <PublicShell cfg={cfg}>
        <Hero cfg={cfg} courtCount={grid.courts.length} />
        <Rates bands={bands} sym={cfg.currencySymbol} />
        <OpenPlayBanner enabled={openPlay} />
        <BookingWidget cfg={cfg} today={today} initial={grid} equipment={equipment} />
        <div className="card" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          <CourtInfo cfg={cfg} bands={bands} equipment={equipment} />
        </div>
      </PublicShell>
    </>
  );
}

async function hasOpenPlay(): Promise<boolean> {
  const { query } = await import("@/lib/db");
  const rows = await query<{ n: number }>("SELECT count(*)::int AS n FROM open_play_sessions WHERE status='open' AND date >= current_date");
  return rows[0]?.n > 0;
}
