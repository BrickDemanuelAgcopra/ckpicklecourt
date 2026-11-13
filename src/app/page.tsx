import Splash from "@/components/Splash";
import Hero from "@/components/Hero";
import BookingWidget from "@/components/BookingWidget";
import PublicShell from "@/components/PublicShell";
import ChatWidget from "@/components/ChatWidget";
import { telegramEnabled } from "@/lib/telegram";
import { CourtInfo, Rates } from "@/components/Sections";
import { OpenPlayBanner } from "@/components/OpenPlayJoin";
import { upcomingOpenPlay } from "@/lib/openPlayQueries";
import { getConfig, getEquipment, getRateBands } from "@/lib/config";
import { getDayGrid } from "@/lib/availability";
import { expireOverdueHolds } from "@/lib/bookings";
import { todayISO } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Home() {
  await expireOverdueHolds().catch(() => {});
  const today = todayISO();
  const [cfg, bands, equipment, grid, openPlay] = await Promise.all([getConfig(), getRateBands(), getEquipment(), getDayGrid(today), upcomingOpenPlay()]);
  return (
    <>
      <Splash name={cfg.courtName} logoUrl={cfg.logoUrl} />
      <PublicShell cfg={cfg}>
        <Hero cfg={cfg} courtCount={grid.courts.length} />
        <Rates bands={bands} sym={cfg.currencySymbol} />
        <OpenPlayBanner sessions={openPlay} sym={cfg.currencySymbol} />
        <BookingWidget cfg={cfg} today={today} initial={grid} equipment={equipment} />
        <div className="card" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          <CourtInfo cfg={cfg} bands={bands} equipment={equipment} />
        </div>
      </PublicShell>
      <ChatWidget
        enabled={telegramEnabled()}
        courtName={cfg.courtName}
        logoUrl={cfg.logoUrl}
        faqs={cfg.faqs ?? []}
        contactNumber={cfg.contactNumber}
        facebookPage={cfg.facebookPage}
      />
    </>
  );
}

