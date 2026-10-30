import { notFound } from "next/navigation";
import PublicShell from "@/components/PublicShell";
import Checkout from "@/components/Checkout";
import { getConfig } from "@/lib/config";
import { expireOverdueHolds, getBooking } from "@/lib/bookings";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await expireOverdueHolds().catch(() => {});
  const [cfg, booking] = await Promise.all([getConfig(), getBooking(id)]);
  if (!booking) notFound();
  return (
    <PublicShell cfg={cfg}>
      <Checkout cfg={cfg} booking={booking} />
    </PublicShell>
  );
}
