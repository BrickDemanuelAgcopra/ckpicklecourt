"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ic } from "./Icons";
import { money } from "@/lib/format";
import { addDaysISO, hourParts, longDate, monthRangeLabel, rangeLabel, shortDay } from "@/lib/time";
import type { DayGrid, Equipment, GridCell, SiteConfig } from "@/lib/types";

type Sel = { courtId: number; hour: number; price: number };

const LEGEND: [string, string][] = [
  ["Open", "var(--ck-slot-open-bg)"],
  ["Booked", "var(--ck-slot-booked-bg)"],
  ["Pending", "var(--ck-slot-pending-bg)"],
  ["Passed", "var(--ck-slot-passed-bg)"],
  ["Open Play", "var(--ck-slot-openplay-bg)"],
  ["Promo", "var(--ck-slot-promo-border)"],
];

export default function BookingWidget({ cfg, today, initial, equipment }: { cfg: SiteConfig; today: string; initial: DayGrid; equipment: Equipment[] }) {
  const router = useRouter();
  const [date, setDate] = useState(initial.date);
  const [grid, setGrid] = useState<DayGrid>(initial);
  const [stripStart, setStripStart] = useState(today);
  const [sel, setSel] = useState<Sel[]>([]);
  const [step, setStep] = useState<"none" | "details" | "equipment">("none");
  const [loading, setLoading] = useState(false);
  const maxDate = addDaysISO(today, cfg.bookingWindowDays);
  const sym = cfg.currencySymbol;

  const load = useCallback(async (d: string) => {
    const r = await fetch(`/api/availability?date=${d}`, { cache: "no-store" });
    if (r.ok) setGrid(await r.json());
  }, []);

  // live refresh every 15 s so other guests' holds show as PENDING
  useEffect(() => {
    const t = setInterval(() => load(date), 15000);
    return () => clearInterval(t);
  }, [date, load]);

  const pickDate = (d: string) => {
    setDate(d);
    setSel([]);
    load(d);
  };
  const stripDays = useMemo(() => Array.from({ length: 14 }, (_, i) => addDaysISO(stripStart, i)), [stripStart]);

  const cellMap = useMemo(() => {
    const m = new Map<string, GridCell>();
    for (const c of grid.cells) m.set(`${c.courtId}:${c.hour}`, c);
    return m;
  }, [grid]);

  const toggle = (c: GridCell) => {
    if (c.status === "open_play") return; // open play join flow handled separately
    if (c.status !== "open" && c.status !== "promo") return;
    setSel((s) => {
      const i = s.findIndex((x) => x.courtId === c.courtId && x.hour === c.hour);
      if (i >= 0) return s.filter((_, j) => j !== i);
      return [...s, { courtId: c.courtId, hour: c.hour, price: c.price }].sort((a, b) => a.courtId - b.courtId || a.hour - b.hour);
    });
  };
  const subtotal = sel.reduce((a, s) => a + s.price, 0);
  const fee = cfg.bookingFeePerHour ? cfg.bookingFee * sel.length : cfg.bookingFee;
  const byCourt = grid.courts.map((c) => ({ court: c, hours: sel.filter((s) => s.courtId === c.id) })).filter((g) => g.hours.length);

  const slotTitle = (c: GridCell) =>
    c.status === "booked" ? "Already booked" : c.status === "pending" ? "Pending approval" : c.status === "unavailable" ? "This court is temporarily unavailable" : c.status === "closed" ? "This hour is closed" : c.status === "passed" ? "This time has passed" : c.status === "open_play" ? "Tap to join Open Play" : "Tap to select";

  return (
    <>
      <section className="card booking" id="book">
        <div className="booking-left">
          <div className="date-head">
            <button className="icon-btn" aria-label="Previous two weeks" disabled={stripStart <= today} onClick={() => setStripStart((s) => (addDaysISO(s, -14) < today ? today : addDaysISO(s, -14)))}>
              <Ic.ChevronLeft size={16} />
            </button>
            <div style={{ flex: 1 }}>
              <h2>{date === today ? "Today" : longDate(date).split(",")[0]}</h2>
              <p>{longDate(date)}</p>
            </div>
            <label className="jump">
              <Ic.Calendar size={14} /> <span className="jump-text">Jump to date</span>
              <input type="date" aria-label="Jump to date" min={today} max={maxDate} value={date} onChange={(e) => {
                const v = e.target.value;
                if (!v || v < today || v > maxDate) return;
                pickDate(v);
                setStripStart(v);
              }} />
            </label>
            <button className="icon-btn" aria-label="Next two weeks" disabled={addDaysISO(stripStart, 14) > maxDate} onClick={() => setStripStart((s) => addDaysISO(s, 14))}>
              <Ic.ChevronRight size={16} />
            </button>
          </div>
          <div className="eyebrow month-label">{monthRangeLabel(stripDays[0], stripDays[13])}</div>
          <div className="strip">
            {stripDays.map((d) => {
              const { dow, day } = shortDay(d);
              const disabled = d > maxDate;
              return (
                <button key={d} className={`day-pill${d === date ? " active" : ""}`} disabled={disabled} style={disabled ? { opacity: 0.35 } : undefined} onClick={() => pickDate(d)}>
                  <small>{dow}</small>
                  <b>{day}</b>
                </button>
              );
            })}
          </div>

          <div className="legend" style={{ marginTop: 18 }}>
            <span style={{ width: "100%", textAlign: "center", marginBottom: 2 }}>Tap an open slot below to book</span>
            {LEGEND.map(([l, c]) => (
              <span key={l}>
                <i style={l === "Promo" ? { border: `2px solid ${c}`, background: "#fff" } : { background: c }} />
                {l}
              </span>
            ))}
          </div>
          <div className="grid-head">
            <h2>Available hours</h2>
            <span>{cfg.openingHoursText}</span>
          </div>

          <div className="grid" style={{ gridTemplateColumns: `var(--time-col) repeat(${grid.courts.length}, minmax(0, 1fr))` }}>
            <div />
            {grid.courts.map((c) => (
              <div className="court-h" key={c.id}>
                {c.name}
                <small>({c.kind})</small>
              </div>
            ))}
            {grid.bands.map((b) => (
              <GridBandRows key={b.id} band={b} courts={grid.courts} cellMap={cellMap} sel={sel} onToggle={toggle} sym={sym} showSep={cfg.showRateSeparators} slotTitle={slotTitle} />
            ))}
          </div>
          {grid.bands.length === 0 && <p className="muted" style={{ textAlign: "center", padding: 20 }}>No bookable hours on this day.</p>}
        </div>

        <aside className="booking-right">
          <div className="summary">
            {sel.length === 0 ? (
              <div className="empty">Tap an open hour to start.</div>
            ) : (
              byCourt.map(({ court, hours }) => (
                <div className="court-group" key={court.id}>
                  <h4>
                    {court.name}
                    <small>({hours.length} hr{hours.length > 1 ? "s" : ""})</small>
                  </h4>
                  {hours.map((h) => (
                    <div className="hour-chip" key={h.hour}>
                      <b>{rangeLabel(h.hour, h.hour + 1)}</b>
                      <span>
                        {money(h.price, sym)}
                        <button aria-label="Remove hour" onClick={() => setSel((s) => s.filter((x) => !(x.courtId === h.courtId && x.hour === h.hour)))}>
                          ×
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}
            <div className="total">
              <span>{sel.length} hour(s)</span>
              <b>{money(subtotal, sym)}</b>
            </div>
            {sel.length ? (
              <button className="btn btn-primary btn-block" onClick={() => setStep("details")}>
                Reserve {sel.length} hour{sel.length > 1 ? "s" : ""} · {money(subtotal, sym)}
              </button>
            ) : (
              <button className="btn btn-muted btn-block" disabled>
                Select hours to continue
              </button>
            )}
            <button className={`btn btn-sm clear-btn ${sel.length ? "btn-outline" : "btn-muted"}`} disabled={!sel.length} onClick={() => setSel([])}>
              Clear
            </button>
          </div>
        </aside>
      </section>

      {step !== "none" && (
        <DetailsFlow
          cfg={cfg}
          date={date}
          sel={sel}
          courts={grid.courts}
          equipment={equipment}
          fee={fee}
          step={step}
          setStep={setStep}
          loading={loading}
          onSubmit={async (guest, eq) => {
            setLoading(true);
            try {
              const r = await fetch("/api/bookings", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ date, slots: sel.map((s) => ({ courtId: s.courtId, hour: s.hour })), equipment: eq, ...guest }),
              });
              const j = await r.json();
              if (!r.ok) {
                if (j.code === "conflict") {
                  load(date);
                  setSel([]);
                  setStep("none");
                }
                return j.error || "Something went wrong";
              }
              router.push(`/checkout/${j.id}`);
              return null;
            } finally {
              setLoading(false);
            }
          }}
          onClose={() => setStep("none")}
        />
      )}
    </>
  );
}

function GridBandRows({ band, courts, cellMap, sel, onToggle, sym, showSep, slotTitle }: {
  band: DayGrid["bands"][number];
  courts: DayGrid["courts"];
  cellMap: Map<string, GridCell>;
  sel: Sel[];
  onToggle: (c: GridCell) => void;
  sym: string;
  showSep: boolean;
  slotTitle: (c: GridCell) => string;
}) {
  return (
    <>
      {showSep && (
        <div className="band-sep">
          <span>
            {money(band.price, sym)}/hr · {rangeLabel(band.startHour, band.endHour)}
          </span>
        </div>
      )}
      {band.hours.map((h) => {
        const a = hourParts(h), b = hourParts(h + 1);
        return (
          <RowFrag key={h}>
            <div className="time-cell">
              {a.time} – {b.time}
              <small>
                {a.suffix} &nbsp;&nbsp; {b.suffix}
              </small>
            </div>
            {courts.map((c) => {
              const cell = cellMap.get(`${c.id}:${h}`);
              if (!cell) return <div key={c.id} />;
              const selected = sel.some((s) => s.courtId === c.id && s.hour === h);
              const cls = selected ? "slot-selected" : `slot-${cell.status}`;
              const text = selected ? "Selected" : cell.status === "booked" ? `Booked${cell.label ? ` (${cell.label})` : ""}` : cell.status === "open_play" ? "Open Play" : cell.status === "promo" ? `Promo ${money(cell.price, sym)}` : cell.status.replace("_", " ");
              const clickable = cell.status === "open" || cell.status === "promo" || selected;
              return (
                <button key={c.id} className={`slot ${cls}`} disabled={!clickable} title={slotTitle(cell)} onClick={() => onToggle(cell)}>
                  {text}
                </button>
              );
            })}
          </RowFrag>
        );
      })}
    </>
  );
}
function RowFrag({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/* ───────── Booking details + equipment modals ───────── */
function DetailsFlow({ cfg, date, sel, courts, equipment, fee, step, setStep, loading, onSubmit, onClose }: {
  cfg: SiteConfig;
  date: string;
  sel: Sel[];
  courts: DayGrid["courts"];
  equipment: Equipment[];
  fee: number;
  step: "details" | "equipment";
  setStep: (s: "none" | "details" | "equipment") => void;
  loading: boolean;
  onSubmit: (guest: { guestName: string; guestPhone: string; guestEmail: string }, eq: { equipmentId: number; qty: number }[]) => Promise<string | null>;
  onClose: () => void;
}) {
  const sym = cfg.currencySymbol;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [eqQty, setEqQty] = useState<Record<number, number>>({});
  const [avail, setAvail] = useState<Record<number, number>>({});
  const subtotal = sel.reduce((a, s) => a + s.price, 0);
  const eqTotal = equipment.reduce((a, e) => a + (eqQty[e.id] || 0) * e.price, 0);
  const total = subtotal + fee + eqTotal;
  const hours = useMemo(() => [...new Set(sel.map((s) => s.hour))], [sel]);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "details") firstField.current?.focus();
  }, [step]);

  useEffect(() => {
    if (step !== "equipment") return;
    fetch(`/api/equipment-availability?date=${date}&hours=${hours.join(",")}`)
      .then((r) => r.json())
      .then((j) => setAvail(j.available || {}))
      .catch(() => {});
  }, [step, date, hours]);

  const validate = () => {
    if (name.trim().length < 2) return "Please enter your full name.";
    if (!/^[0-9+\-\s()]{7,20}$/.test(phone.trim())) return "Please enter a valid contact number.";
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Please enter a valid email address.";
    return null;
  };

  const submit = async () => {
    setErr(null);
    const eq = Object.entries(eqQty).filter(([, q]) => q > 0).map(([id, qty]) => ({ equipmentId: Number(id), qty }));
    const e = await onSubmit({ guestName: name.trim(), guestPhone: phone.trim(), guestEmail: email.trim() }, eq);
    if (e) setErr(e);
  };

  const byCourt = courts.map((c) => ({ court: c, hours: sel.filter((s) => s.courtId === c.id) })).filter((g) => g.hours.length);
  const anyEq = Object.values(eqQty).some((q) => q > 0);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h3>Booking details</h3>
        <div className="receipt">
          <div className="line">
            <b>{longDate(date)}</b>
          </div>
          {byCourt.map(({ court, hours }) => (
            <div key={court.id}>
              <div className="court-label">{court.name.toUpperCase()}</div>
              {hours.map((h) => (
                <div className="line" key={h.hour}>
                  <span>{rangeLabel(h.hour, h.hour + 1)}</span>
                  <b>{money(h.price, sym)}</b>
                </div>
              ))}
            </div>
          ))}
          {equipment.filter((e) => eqQty[e.id] > 0).map((e) => (
            <div className="line" key={e.id} style={{ marginTop: 6 }}>
              <span>
                {e.name} rental × {eqQty[e.id]}
              </span>
              <b>{money(eqQty[e.id] * e.price, sym)}</b>
            </div>
          ))}
          {fee > 0 && (
            <div className="line" style={{ marginTop: 6 }}>
              <span>Processing fee</span>
              <b>{money(fee, sym)}</b>
            </div>
          )}
          <div className="total-line">
            <span>Total</span>
            <span>{money(total, sym)}</span>
          </div>
        </div>
        {err && <div className="error">{err}</div>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = validate();
            if (v) return setErr(v);
            setErr(null);
            if (equipment.length) setStep("equipment");
            else submit();
          }}
        >
          <div className="field">
            <label htmlFor="fullName">
              Full Name <span className="req">*</span>
            </label>
            <input id="fullName" name="fullName" ref={firstField} placeholder="Juan dela Cruz" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div className="field">
            <label htmlFor="email">
              Email Address <span className="opt">(optional)</span>
            </label>
            <input id="email" name="email" type="email" placeholder="juandelacruz@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="phone">
              Contact Number <span className="req">*</span>
            </label>
            <input id="phone" name="phone" type="tel" placeholder="0917..." value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </div>
          <p className="consent">
            By submitting this booking, you consent to the collection and use of your information as described in our{" "}
            <a href="/privacy" target="_blank">
              Privacy Policy
            </a>
            .
          </p>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "Please wait…" : "Continue"}
          </button>
        </form>

        {step === "equipment" && (
          <div className="overlay" onClick={() => setStep("details")}>
            <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" aria-label="Close" onClick={() => setStep("details")}>
                ×
              </button>
              <h3>Need equipments?</h3>
              <p className="muted" style={{ marginBottom: 12 }}>
                Please select the following equipments you would like to rent
              </p>
              {equipment.map((e) => {
                const free = avail[e.id] ?? e.inventory_total;
                const on = (eqQty[e.id] || 0) > 0;
                return (
                  <div className={`equip-card${on ? " on" : ""}`} key={e.id}>
                    <label className="top">
                      <input type="checkbox" checked={on} disabled={free === 0} onChange={(ev) => setEqQty((q) => ({ ...q, [e.id]: ev.target.checked ? 1 : 0 }))} />
                      {e.name}
                      <span className="price">
                        {money(e.price, sym)}/{e.unit} per session
                      </span>
                    </label>
                    <div className="avail">
                      {free} {e.unit}
                      {free === 1 ? "" : "s"} available for your selected time
                    </div>
                    {on && (
                      <div className="qty field" style={{ marginBottom: 0 }}>
                        <label>Number of {e.unit}</label>
                        <select value={eqQty[e.id]} onChange={(ev) => setEqQty((q) => ({ ...q, [e.id]: Number(ev.target.value) }))}>
                          {Array.from({ length: free }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n} {e.unit}
                              {n > 1 ? "s" : ""}
                            </option>
                          ))}
                        </select>
                        <div className="line" style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span>{e.name} rental total</span>
                          <b>{money((eqQty[e.id] || 0) * e.price, sym)}</b>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "var(--ck-ink)", margin: "6px 0 14px" }}>
                <span>Equipment rental total</span>
                <span>{money(eqTotal, sym)}</span>
              </div>
              {err && <div className="error">{err}</div>}
              <button className="btn btn-primary btn-block" style={{ background: "var(--ck-green-mid)" }} disabled={loading} onClick={submit}>
                {loading ? "Reserving…" : anyEq ? "Continue" : "Continue without equipment"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
