"use client";
import { useState } from "react";
import Link from "next/link";
import { money, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import { hourLabel, longDate } from "@/lib/time";
import type { BookingDetail } from "@/lib/types";

export function BookingCard({ b, sym, showLink = true }: { b: BookingDetail; sym: string; showLink?: boolean }) {
  const byDate = new Map<string, typeof b.slots>();
  for (const s of b.slots) byDate.set(s.date, [...(byDate.get(s.date) || []), s]);
  return (
    <div className="receipt" style={{ textAlign: "left" }}>
      <div className="line">
        <span className="muted">Booking reference</span>
        <b className="mono">{b.confirmation_id}</b>
      </div>
      <div className="line">
        <span className="muted">Status</span>
        <span className={`status-chip chip-${STATUS_TONE[b.status]}`}>{STATUS_LABEL[b.status]}</span>
      </div>
      <div className="line">
        <span className="muted">Name</span>
        <b>{b.guest_name}</b>
      </div>
      {[...byDate.entries()].map(([d, slots]) => (
        <div key={d}>
          <div className="court-label">{longDate(d).toUpperCase()}</div>
          {slots.map((s) => (
            <div className="line" key={`${s.court_id}-${s.hour}`}>
              <span>
                {s.court_name} · {hourLabel(s.hour)} – {hourLabel(s.hour + 1)}
              </span>
              <b>{money(s.price, sym)}</b>
            </div>
          ))}
        </div>
      ))}
      {b.equipment.map((e) => (
        <div className="line" key={e.equipment_id}>
          <span>
            {e.name} × {e.qty}
          </span>
          <b>{money(Number(e.unit_price) * e.qty, sym)}</b>
        </div>
      ))}
      {Number(b.booking_fee) > 0 && (
        <div className="line">
          <span>Processing fee</span>
          <b>{money(b.booking_fee, sym)}</b>
        </div>
      )}
      <div className="total-line">
        <span>Total</span>
        <span>{money(b.total, sym)}</span>
      </div>
      {b.status === "balance_due" && b.partial_percent ? (
        <p className="muted" style={{ marginTop: 8 }}>
          Partial payment of {b.partial_percent}% received. Please settle the balance at the court.
        </p>
      ) : null}
      {showLink && (
        <p className="muted" style={{ marginTop: 10 }}>
          Track this booking anytime at{" "}
          <Link href={`/bookings/${b.id}`} className="mono">
            /bookings/{b.id.slice(0, 8)}…
          </Link>
        </p>
      )}
    </div>
  );
}

export default function TrackBooking({ logoUrl, sym, onClose }: { logoUrl: string; sym: string; onClose?: () => void }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "found" | "none">("idle");
  const [results, setResults] = useState<BookingDetail[]>([]);
  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setState("loading");
    const r = await fetch(`/api/bookings/lookup?q=${encodeURIComponent(q.trim())}`);
    const j = await r.json();
    if (j.bookings?.length) {
      setResults(j.bookings);
      setState("found");
    } else setState("none");
  };
  return (
    <div className="track">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl} alt="" />
      <h3>Track your Booking Status</h3>
      <p>Please paste the booking reference number on the search box and your court reservation status will appear.</p>
      <form onSubmit={search} className="status-search-form">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Confirmation ID or the name you booked under" aria-label="Confirmation ID or booking name" />
        <button className="btn btn-primary" type="submit" disabled={state === "loading"}>
          Search
        </button>
      </form>
      {state === "none" && (
        <div className="notfound">
          <div className="x">✕</div>
          No booking found under “{q}”. The name has to match exactly as you typed it when booking (capitals included) — or search with your Confirmation ID instead.
          <div style={{ marginTop: 14 }}>
            <Link href="/?book=1" className="btn btn-primary btn-block" onClick={onClose}>
              Book a Court
            </Link>
          </div>
        </div>
      )}
      {state === "found" && (
        <div style={{ marginTop: 14 }}>
          {results.map((b) => (
            <BookingCard key={b.id} b={b} sym={sym} />
          ))}
        </div>
      )}
    </div>
  );
}
