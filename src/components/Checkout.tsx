"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ic } from "./Icons";
import { BookingCard } from "./TrackBooking";
import { money } from "@/lib/format";
import type { BookingDetail, SiteConfig } from "@/lib/types";

export default function Checkout({ cfg, booking }: { cfg: SiteConfig; booking: BookingDetail }) {
  const router = useRouter();
  const sym = cfg.currencySymbol;
  const [left, setLeft] = useState<number>(() => (booking.hold_expires_at ? Math.max(0, Math.floor((new Date(booking.hold_expires_at).getTime() - Date.now()) / 1000)) : 0));
  const [file, setFile] = useState<File | null>(null);
  const [partial, setPartial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [qrFull, setQrFull] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const awaiting = booking.status === "awaiting_payment";

  useEffect(() => {
    if (!awaiting || done) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [awaiting, done]);
  const expired = awaiting && left <= 0 && !done;

  const submit = async () => {
    if (!file) return setErr("Please attach your payment receipt.");
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("receipt", file);
    if (partial) fd.append("partial", "1");
    const r = await fetch(`/api/bookings/${booking.id}/receipt`, { method: "POST", body: fd });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Upload failed");
    setDone(j.confirmationId);
  };

  const cancel = async () => {
    if (!confirm("Cancel this reservation and release the hours?")) return;
    await fetch(`/api/bookings/${booking.id}/cancel`, { method: "POST" });
    router.push("/?book=1");
  };

  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  const payNow = partial && cfg.partialPaymentEnabled ? (Number(booking.total) * cfg.partialPaymentPercent) / 100 : Number(booking.total);

  if (done) {
    return (
      <div className="card" style={{ padding: 26, maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 44, color: "var(--ck-green-mid)" }}>✓</div>
        <h2 style={{ fontSize: 22 }}>Receipt received</h2>
        <p className="muted" style={{ margin: "8px 0 16px" }}>Please take a screenshot of your confirmation id for your reference. We&apos;ll review your payment and confirm your booking shortly.</p>
        <div className="receipt" style={{ background: "var(--ck-gold-bg)", borderColor: "#e3d4a6" }}>
          <div className="eyebrow" style={{ color: "var(--ck-gold-text)" }}>Booking reference</div>
          <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: "var(--ck-green)", marginTop: 4 }}>{done}</div>
        </div>
        <p className="muted">
          To track your booking status anytime, go to:{" "}
          <Link href={`/bookings/${booking.id}`} className="mono">
            {(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")}/bookings/{booking.id}
          </Link>
        </p>
        <Link href={`/bookings/${booking.id}`} className="btn btn-primary btn-block" style={{ marginTop: 10 }}>
          View booking status
        </Link>
      </div>
    );
  }

  if (!awaiting || expired) {
    return (
      <div className="card" style={{ padding: 26, maxWidth: 560, margin: "0 auto" }}>
        <h2 style={{ fontSize: 20 }}>{expired ? "Your reservation has been released" : "This checkout is no longer open"}</h2>
        <p className="muted" style={{ margin: "8px 0 16px" }}>
          {expired ? "The payment window ended before a receipt was uploaded, so the hours were reopened for other players." : "This booking has already been submitted or closed."}
        </p>
        <BookingCard b={booking} sym={sym} showLink={!expired} />
        <Link href="/?book=1" className="btn btn-primary btn-block" style={{ marginTop: 12 }}>
          Book a Court
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr", maxWidth: 980, margin: "0 auto" }}>
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="eyebrow" style={{ color: "var(--ck-ink-faint)" }}>Booking reference</div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: "var(--ck-green)" }}>{booking.confirmation_id}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="eyebrow" style={{ color: "var(--ck-ink-faint)" }}>Time left to pay</div>
            <div className="countdown">
              {mm}:{ss}
            </div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Your hours are held for {cfg.paymentWindowMinutes} minutes. Pay and upload your receipt before the timer ends, or your reservation will be released.
        </p>

        <div className="step-title">Step 1: Scan the QR code to pay</div>
        <div className="qr-box">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cfg.payment.qrUrl} alt={`${cfg.payment.bankName} QR code`} onClick={() => setQrFull(true)} style={{ cursor: "zoom-in" }} />
          <p className="muted" style={{ margin: "6px 0 0" }}>Tap the QR to view it full screen</p>
          <div className="bank-lines">
            <div>
              <b>{cfg.payment.bankName}</b> · {cfg.payment.accountName}
            </div>
            <div className="mono">{cfg.payment.accountNumber}</div>
            <div style={{ marginTop: 8, fontSize: 16 }}>
              Amount to pay: <b>{money(payNow, sym)}</b>
            </div>
          </div>
          <a className="btn btn-outline btn-sm" href={cfg.payment.qrUrl} download style={{ marginTop: 10, background: "#fff" }}>
            <Ic.Download size={14} /> Download QR
          </a>
        </div>

        {cfg.partialPaymentEnabled && (
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, fontSize: 13.5 }}>
            <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
            <span>
              Pay {cfg.partialPaymentPercent}% now ({money((Number(booking.total) * cfg.partialPaymentPercent) / 100, sym)}) and settle the balance at the court.
            </span>
          </label>
        )}

        <div className="step-title">Step 2: Upload receipt and submit</div>
        <div className="upload">
          <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
          {file ? (
            <div>
              <b style={{ color: "var(--ck-ink)" }}>{file.name}</b> <span className="muted">({Math.round(file.size / 1024)} KB)</span>
              <div>
                <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => fileRef.current?.click()}>
                  Choose another file
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn-outline" onClick={() => fileRef.current?.click()}>
              Choose receipt screenshot
            </button>
          )}
          <p className="muted" style={{ margin: "8px 0 0" }}>JPG, PNG, WebP or PDF up to 10 MB</p>
        </div>
        {err && (
          <div className="error" style={{ marginTop: 12 }}>
            {err}
          </div>
        )}
        <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy || !file} onClick={submit}>
          {busy ? "Submitting…" : "Submit Booking"}
        </button>
        <button className="btn btn-outline btn-block" style={{ marginTop: 8 }} onClick={cancel}>
          Cancel booking
        </button>
      </div>
      <div>
        <BookingCard b={booking} sym={sym} showLink={false} />
      </div>
      {qrFull && (
        <div className="lightbox" onClick={() => setQrFull(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cfg.payment.qrUrl} alt="Payment QR" style={{ background: "#fff", padding: 16 }} />
          <button className="close" onClick={() => setQrFull(false)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
