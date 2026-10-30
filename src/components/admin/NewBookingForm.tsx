"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { hourLabel, longDate } from "@/lib/time";
import type { Court, DayGrid, Equipment, RateBand } from "@/lib/types";
import { PaymentFields, type PaymentValue } from "./PaymentDialog";

const TAKEN = new Set(["booked", "pending", "closed", "open_play", "unavailable"]);

export default function NewBookingForm({ today, sym, courts, bands, equipment }: { today: string; sym: string; courts: Court[]; bands: RateBand[]; equipment: Equipment[] }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [courtId, setCourtId] = useState(courts[0]?.id ?? 0);
  const [hours, setHours] = useState<number[]>([]);
  const [grid, setGrid] = useState<DayGrid | null>(null);
  const [eq, setEq] = useState<Record<number, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [paidNow, setPaidNow] = useState(true);
  const [pay, setPay] = useState<PaymentValue>({ amount: 0, method: "gcash" });
  const [amountTouched, setAmountTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/availability?date=${date}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((g: DayGrid) => live && setGrid(g))
      .catch(() => live && setGrid(null));
    return () => {
      live = false;
    };
  }, [date]);

  const cells = useMemo(() => (grid?.cells ?? []).filter((c) => c.courtId === courtId).sort((a, b) => a.hour - b.hour), [grid, courtId]);
  // Fallback to the rate bands while the day grid loads.
  const priceOf = (h: number) => cells.find((c) => c.hour === h)?.price ?? bands.find((b) => h >= b.start_hour && h < b.end_hour)?.price ?? 0;
  const courtTotal = hours.reduce((s, h) => s + priceOf(h), 0);
  const eqTotal = equipment.reduce((s, e) => s + (eq[e.id] ?? 0) * e.price, 0);
  const total = courtTotal + eqTotal;
  const amount = amountTouched ? pay.amount : total;

  const toggle = (h: number) => setHours((hs) => (hs.includes(h) ? hs.filter((x) => x !== h) : [...hs, h].sort((a, b) => a - b)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!hours.length) return setErr("Pick at least one hour.");
    setBusy(true);
    const r = await fetch("/api/admin/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        op: "create",
        booking: {
          date,
          slots: hours.map((hour) => ({ courtId, hour })),
          equipment: Object.entries(eq)
            .filter(([, q]) => q > 0)
            .map(([id, qty]) => ({ equipmentId: Number(id), qty })),
          guestName: name,
          guestPhone: phone,
          guestEmail: email || undefined,
        },
        payment: paidNow && amount > 0 ? { ...pay, amount } : undefined,
        note: note || undefined,
      }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Could not save the booking");
    router.push(`/admin/bookings?view=all&q=${encodeURIComponent(j.booking.confirmation_id)}`);
  }

  return (
    <form className="nb" onSubmit={submit}>
      <section className="nb-card">
        <h3>1. When</h3>
        <div className="nb-row">
          <label>
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setHours([]);
              }}
              required
            />
          </label>
          <label>
            Court
            <div className="pay-methods">
              {courts.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`btn btn-sm ${c.id === courtId ? "btn-primary" : "btn-outline"}`}
                  onClick={() => {
                    setCourtId(c.id);
                    setHours([]);
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </label>
        </div>
        <p className="muted" style={{ margin: "10px 0 6px" }}>
          {longDate(date)} — tap the hours they&apos;re playing.
        </p>
        <div className="nb-hours">
          {!grid && <span className="muted">Loading availability…</span>}
          {cells.map((c) => {
            const taken = TAKEN.has(c.status);
            const on = hours.includes(c.hour);
            return (
              <button
                type="button"
                key={c.hour}
                disabled={taken}
                className={`nb-hour${on ? " on" : ""}${taken ? " taken" : ""}`}
                onClick={() => toggle(c.hour)}
                title={taken ? c.status.replace("_", " ") : `${hourLabel(c.hour)} – ${hourLabel(c.hour + 1)}`}
              >
                <b>{hourLabel(c.hour).replace(":00", "")}</b>
                <small>{taken ? (c.status === "booked" ? c.label || "booked" : c.status.replace("_", " ")) : money(c.price, sym)}</small>
              </button>
            );
          })}
        </div>
      </section>

      {equipment.length > 0 && (
        <section className="nb-card">
          <h3>2. Equipment</h3>
          <div className="nb-row">
            {equipment.map((e) => (
              <label key={e.id}>
                {e.name} <span className="muted">{money(e.price, sym)} each</span>
                <input type="number" min={0} max={50} value={eq[e.id] ?? 0} onChange={(x) => setEq({ ...eq, [e.id]: Math.max(0, Number(x.target.value) || 0) })} />
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="nb-card">
        <h3>{equipment.length ? "3" : "2"}. Guest</h3>
        <div className="nb-row">
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />
          </label>
          <label>
            Mobile number
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" placeholder="09xx xxx xxxx" maxLength={40} />
          </label>
          <label>
            Email <span className="muted">(optional, sends confirmation)</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} />
          </label>
        </div>
        <label style={{ marginTop: 10 }}>
          Note <span className="muted">(optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. booked via Messenger" />
        </label>
      </section>

      <section className="nb-card">
        <h3>{equipment.length ? "4" : "3"}. Payment</h3>
        <div className="nb-total">
          <span>
            {hours.length} hr{hours.length === 1 ? "" : "s"} court {money(courtTotal, sym)}
            {eqTotal > 0 && ` + equipment ${money(eqTotal, sym)}`}
          </span>
          <b>{money(total, sym)}</b>
        </div>
        <div className="pay-methods" style={{ margin: "10px 0" }}>
          <button type="button" className={`btn btn-sm ${paidNow ? "btn-primary" : "btn-outline"}`} onClick={() => setPaidNow(true)}>
            Payment received
          </button>
          <button type="button" className={`btn btn-sm ${!paidNow ? "btn-primary" : "btn-outline"}`} onClick={() => setPaidNow(false)}>
            Not paid yet
          </button>
        </div>
        {paidNow ? (
          <PaymentFields
            sym={sym}
            value={{ ...pay, amount }}
            onChange={(v) => {
              if (v.amount !== amount) setAmountTouched(true);
              setPay(v);
            }}
          />
        ) : (
          <p className="muted">The booking holds the court as Balance Due. Use Collect balance on the Bookings list when they pay.</p>
        )}
      </section>

      {err && <div className="error">{err}</div>}
      <button className="btn btn-primary" disabled={busy || !hours.length}>
        {busy ? "Saving…" : `Save booking · ${money(total, sym)}`}
      </button>
    </form>
  );
}
