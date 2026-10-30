import PublicShell from "@/components/PublicShell";
import TrackBooking from "@/components/TrackBooking";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const cfg = await getConfig();
  return (
    <PublicShell cfg={cfg}>
      <div style={{ maxWidth: 520, margin: "20px auto" }}>
        <TrackBooking logoUrl={cfg.logoUrl} sym={cfg.currencySymbol} />
      </div>
    </PublicShell>
  );
}
