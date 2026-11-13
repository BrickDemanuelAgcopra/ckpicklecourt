"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { money, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import { hourLabel, longDate, rangeLabel } from "@/lib/time";
import type { AdminSession } from "@/lib/openPlay";
import type { Court } from "@/lib/types";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function OpenPlayAdmin({ today, sym, courts, sessions }: { today: string; sym: string; courts: Court[]; sessions: AdminSession[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ date: today, courtId: courts[0]?.id ?? 0, startHour: 18, endHour: 21, pricePerPlayer: 150, capacity: 8, note: "" });
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const post = async (body: unknown) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/open-play", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ tone: "err", text: j.error || "Failed" });
        return null;
      }
      router.refresh();
      return j;
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (s: AdminSession) => {
    const n = s.roster.length;
    const warn = n
      ? `Cancel this session? ${n} booking${n === 1 ? "" : "s"} (${s.joined} player${s.joined === 1 ? "" : "s"}) will be cancelled and emailed. Refund anyone who already paid.`
      : "Cancel this session and reopen its court hours?";
    if (!confirm(warn)) return;
    const j = await post({ op: "cancel", id: s.id });
    if (j) setMsg({ tone: "ok", text: `Session cancelled${j.cancelledBookings ? `; ${j.cancelledBookings} booking(s) cancelled` : ""}.` });
  };

  const live = sessions.filter((s) => s.status === "open");
  const cancelled = sessions.filter((s) => s.status === "cancelled");

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {msg && <div className={msg.tone === "err" ? "error" : "note"}>{msg.text}</div>}

      <div className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>New session</h2>
        <form
          className="op-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const j = await post({ op: "create", ...form, note: form.note.trim() || undefined });
            if (j) setMsg({ tone: "ok", text: `Open Play scheduled for ${longDate(form.date)}, ${rangeLabel(form.startHour, form.endHour)}.` });
          }}
        >
          <div className="field">
            <label htmlFor="op-date">Date</label>
            <input id="op-date" type="date" min={today} value={form.date} onChange={(e) => set("date", e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="op-court">Court</label>
            <select id="op-court" value={form.courtId} onChange={(e) => set("courtId", Number(e.target.value))}>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="op-start">Starts</label>
            <select
              id="op-start"
              value={form.startHour}
              onChange={(e) => {
                const h = Number(e.target.value);
                setForm((f) => ({ ...f, startHour: h, endHour: f.endHour > h ? f.endHour : h + 1 }));
              }}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="op-end">Ends</label>
            <select id="op-end" value={form.endHour} onChange={(e) => set("endHour", Number(e.target.value))}>
              {HOURS.map((h) => h + 1)
                .filter((h) => h > form.startHour)
                .map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="op-price">Price per player ({sym})</label>
            <input id="op-price" type="number" min={0} step="any" value={form.pricePerPlayer} onChange={(e) => set("pricePerPlayer", Number(e.target.value))} required />
          </div>
          <div className="field">
            <label htmlFor="op-cap">Max players</label>
            <input id="op-cap" type="number" min={1} max={64} value={form.capacity} onChange={(e) => set("capacity", Number(e.target.value))} required />
          </div>
          <div className="field op-note">
            <label htmlFor="op-note">
              Note for players <span className="opt">(optional)</span>
            </label>
            <input id="op-note" maxLength={200} placeholder="All levels welcome, paddles available to rent" value={form.note} onChange={(e) => set("note", e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={busy || !courts.length}>
            {busy ? "Saving…" : "Schedule Open Play"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 8 }}>
          The session&apos;s court hours come off the regular booking grid. Hours that are already booked or closed can&apos;t be used.
        </p>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Upcoming sessions</h2>
        {!live.length && <p className="muted">No Open Play scheduled yet.</p>}
        <div style={{ display: "grid", gap: 14 }}>
          {live.map((s) => {
            const left = Math.max(0, s.capacity - s.joined);
            return (
              <div key={s.id} className="op-session">
                <div className="op-session-head">
                  <div>
                    <b>{longDate(s.date)}</b>
                    <div className="muted">
                      {s.courtName} · {rangeLabel(s.startHour, s.endHour)} · {money(s.pricePerPlayer, sym)}/player
                    </div>
                    {s.note && <div className="muted">“{s.note}”</div>}
                  </div>
                  <div className="op-count">
                    <b>
                      {s.joined}/{s.capacity}
                    </b>
                    <span className="muted">{left ? `${left} left` : "full"}</span>
                  </div>
                  <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => cancel(s)}>
                    Cancel session
                  </button>
                </div>
                {s.roster.length > 0 ? (
                  <div style={{ overflowX: "auto" }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Ref</th>
                          <th>Guest</th>
                          <th>Players</th>
                          <th>Status</th>
                          <th>Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.roster.map((b) => (
                          <tr key={b.id}>
                            <td>
                              <Link className="mono" href={`/admin/bookings?view=all&q=${encodeURIComponent(b.confirmation_id)}`}>
                                {b.confirmation_id}
                              </Link>
                            </td>
                            <td>
                              {b.guest_name}
                              <div className="muted">{b.guest_phone}</div>
                            </td>
                            <td>{b.players}</td>
                            <td>
                              <span className={`status-chip chip-${STATUS_TONE[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                            </td>
                            <td>
                              {money(b.paid, sym)} / {money(b.total, sym)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    Nobody has joined yet.
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {cancelled.length > 0 && (
          <details style={{ marginTop: 14 }}>
            <summary className="muted">{cancelled.length} cancelled session(s)</summary>
            {cancelled.map((s) => (
              <div key={s.id} className="muted" style={{ marginTop: 6 }}>
                {longDate(s.date)} · {s.courtName} · {rangeLabel(s.startHour, s.endHour)}
              </div>
            ))}
          </details>
        )}
      </div>
    </div>
  );
}
