"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { addDaysISO, hourParts, longDate, rangeLabel } from "@/lib/time";
import type { DayGrid } from "@/lib/types";

export default function AdminGrid({ grid, sym }: { grid: DayGrid; sym: string }) {
  const router = useRouter();
  const [sel, setSel] = useState<{ courtId: number; hour: number }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = (d: string) => router.push(`/admin/grid?date=${d}`);

  const apply = async (kind: "closed" | null) => {
    setBusy(true);
    setErr(null);
    const reason = kind ? prompt("Reason for closing (optional)") || undefined : undefined;
    const byCourt = new Map<number, number[]>();
    for (const s of sel) byCourt.set(s.courtId, [...(byCourt.get(s.courtId) || []), s.hour]);
    for (const [courtId, hours] of byCourt) {
      const r = await fetch("/api/admin/slots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ courtId, date: grid.date, hours, kind, reason }) });
      if (!r.ok) setErr((await r.json()).error || "Failed");
    }
    setBusy(false);
    setSel([]);
    router.refresh();
  };

  const toggle = (courtId: number, hour: number) =>
    setSel((s) => (s.some((x) => x.courtId === courtId && x.hour === hour) ? s.filter((x) => !(x.courtId === courtId && x.hour === hour)) : [...s, { courtId, hour }]));
  const selKinds = new Set(sel.map((s) => grid.cells.find((c) => c.courtId === s.courtId && c.hour === s.hour)?.status));

  return (
    <div className="card admin-grid" style={{ padding: 18 }}>
      <div className="date-head">
        <button className="icon-btn" onClick={() => go(addDaysISO(grid.date, -1))}>
          ‹
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 18 }}>{longDate(grid.date)}</h2>
        </div>
        <input type="date" value={grid.date} onChange={(e) => e.target.value && go(e.target.value)} style={{ border: "1px solid var(--ck-line)", borderRadius: 8, padding: "6px 8px" }} />
        <button className="icon-btn" onClick={() => go(addDaysISO(grid.date, 1))}>
          ›
        </button>
      </div>
      {err && <div className="error" style={{ marginTop: 10 }}>{err}</div>}
      <div className="grid" style={{ gridTemplateColumns: `88px repeat(${grid.courts.length}, 1fr)` }}>
        <div />
        {grid.courts.map((c) => (
          <div className="court-h" key={c.id}>
            {c.name}
          </div>
        ))}
        {grid.bands.map((b) => (
          <div key={b.id} style={{ display: "contents" }}>
            <div className="band-sep">
              <span>
                {money(b.price, sym)}/hr · {rangeLabel(b.startHour, b.endHour)}
              </span>
            </div>
            {b.hours.map((h) => {
              const a = hourParts(h), z = hourParts(h + 1);
              return (
                <div key={h} style={{ display: "contents" }}>
                  <div className="time-cell">
                    {a.time} – {z.time}
                    <small>
                      {a.suffix} &nbsp; {z.suffix}
                    </small>
                  </div>
                  {grid.courts.map((c) => {
                    const cell = grid.cells.find((x) => x.courtId === c.id && x.hour === h);
                    if (!cell) return <div key={c.id} />;
                    const on = sel.some((s) => s.courtId === c.id && s.hour === h);
                    const can = cell.status === "open" || cell.status === "closed" || cell.status === "promo";
                    const text = cell.status === "booked" ? `Booked (${cell.label})` : cell.status.replace("_", " ");
                    return (
                      <button key={c.id} className={`slot ${on ? "slot-selected" : `slot-${cell.status}`}`} disabled={!can} onClick={() => toggle(c.id, h)}>
                        {text}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {sel.length > 0 && (
        <div className="actions" style={{ marginTop: 14 }}>
          <span className="muted" style={{ alignSelf: "center" }}>{sel.length} hour(s) selected</span>
          {selKinds.has("open") && (
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => apply("closed")}>
              Close selected hours
            </button>
          )}
          {selKinds.has("closed") && (
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => apply(null)}>
              Reopen selected hours
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => setSel([])}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
