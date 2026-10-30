import Link from "next/link";
import { notFound } from "next/navigation";
import PublicShell from "@/components/PublicShell";
import { BookingCard } from "@/components/TrackBooking";
import { getConfig } from "@/lib/config";
import { expireOverdueHolds, getBooking } from "@/lib/bookings";
import { STATUS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BookingStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await expireOverdueHolds().catch(() => {});
  const [cfg, b] = await Promise.all([getConfig(), getBooking(id)]);
  if (!b) notFound();
  const note: Record<string, string> = {
    awaiting_payment: "We're still waiting for your payment receipt. Finish checkout to keep your hours.",
    pending: "We've received your receipt and will confirm once it's been reviewed.",
    confirmed: "You're all set. See you on the court!",
    balance_due: "Your partial payment is confirmed. Please settle the remaining balance at the court.",
    declined: "We couldn't verify the payment for this booking. Please message us if you think this is a mistake.",
    cancelled: "This booking was cancelled and its hours have been released.",
    expired: "The payment window ended before a receipt was uploaded, so the hours were released.",
  };
  return (
    <PublicShell cfg={cfg}>
      <div style={{ maxWidth: 560, margin: "10px auto" }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Booking status · {STATUS_LABEL[b.status]}</h1>
        <p className="muted" style={{ marginBottom: 14 }}>{note[b.status]}</p>
        <BookingCard b={b} sym={cfg.currencySymbol} showLink={false} />
        {b.receipt_path && (
          <div className="receipt guest-receipt">
            <div className="line">
              <span className="muted">Your payment receipt</span>
              {b.submitted_at && <span className="muted">sent {new Date(b.submitted_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</span>}
            </div>
            <a href={`/api/bookings/${b.id}/receipt`} target="_blank" rel="noopener">
              {b.receipt_path.toLowerCase().endsWith(".pdf") ? (
                <span className="btn btn-outline btn-sm">Open receipt (PDF)</span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/bookings/${b.id}/receipt`} alt="Payment receipt you uploaded" />
              )}
            </a>
            <p className="muted" style={{ margin: "6px 0 0" }}>Tap to open full size. Only people with this booking link can see it.</p>
          </div>
        )}
        {b.status === "awaiting_payment" && (
          <Link href={`/checkout/${b.id}`} className="btn btn-primary btn-block">
            Continue to payment
          </Link>
        )}
        <Link href="/" className="btn btn-outline btn-block" style={{ marginTop: 8 }}>
          Back to courts
        </Link>
      </div>
    </PublicShell>
  );
}
