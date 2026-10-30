"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { money, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import { hourLabel } from "@/lib/time";
import type { BookingDetail } from "@/lib/types";
import PaymentDialog, { METHOD_LABEL, type PaymentValue } from "./PaymentDialog";

export default function BookingsTable({
  bookings,
  sym,
  view,
  partialEnabled,
  partialPercent,
}: {
  bookings: BookingDetail[];
  sym: string;
  view: string;
  partialEnabled: boolean;
  partialPercent: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [paying, setPaying] = useState<BookingDetail | null>(null);

  const pay = async (id: string, payment: PaymentValue): Promise<string | null> => {
    const r = await fetch("/api/admin/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "pay", id, payment }) });
    const j = await r.json();
    if (!r.ok) return j.error || "Failed";
    setPaying(null);
    router.refresh();
    return null;
  };
  const presetsFor = (b: BookingDetail): [string, number][] => {
    const total = Number(b.total);
    const due = Math.max(total - b.paid, 0);
    if (b.paid > 0) return [["Balance", due]];
    const deposit = b.partial_percent ? Math.round((total * b.partial_percent) / 100) : partialEnabled && partialPercent ? Math.round((total * partialPercent) / 100) : 0;
    const out: [string, number][] = [["Full", total]];
    if (deposit && deposit < total) out.push([`Deposit ${b.partial_percent ?? partialPercent}%`, deposit]);
    // a guest who chose to pay the deposit most likely sent the deposit
    return b.partial_payment && out.length > 1 ? [out[1], out[0]] : out;
  };

  const act = async (id: string, action: string, note?: string) => {
    setBusy(id);
    setErr(null);
    const r = await fetch("/api/admin/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "status", id, action, note }) });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) return setErr(j.error || "Failed");
    router.refresh();
  };
  const removeHour = async (id: string, courtId: number, hour: number) => {
    if (!confirm("Remove this hour from the booking?")) return;
    const r = await fetch("/api/admin/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "remove_hour", id, courtId, hour }) });
    if (!r.ok) setErr((await r.json()).error);
    router.refresh();
  };
  const deleteDirty = async () => {
    if (!confirm("Delete expired/abandoned holds older than one day?")) return;
    await fetch("/api/admin/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "delete_dirty" }) });
    router.refresh();
  };

  return (
    <>
      {err && <div className="error">{err}</div>}
      {view === "abandoned" && (
        <button className="btn btn-danger btn-sm" style={{ marginBottom: 12 }} onClick={deleteDirty}>
          Delete dirty bookings
        </button>
      )}
      {bookings.length === 0 ? (
        <p className="muted">Nothing here.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Ref / status</th>
                <th>Guest</th>
                <th>Schedule</th>
                <th>Amount</th>
                <th>Receipt</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="mono" style={{ fontWeight: 700 }}>{b.confirmation_id}</div>
                    <span className={`status-chip chip-${STATUS_TONE[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                    <div className="muted">{new Date(b.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</div>
                    {b.admin_note && <div className="muted">Note: {b.admin_note}</div>}
                  </td>
                  <td>
                    <b>{b.guest_name}</b>
                    <div className="muted">{b.guest_phone}</div>
                    {b.guest_email && <div className="muted">{b.guest_email}</div>}
                  </td>
                  <td>
                    {b.slots.map((s) => (
                      <div key={`${s.court_id}-${s.date}-${s.hour}`} style={{ whiteSpace: "nowrap" }}>
                        {s.date} · {s.court_name} · {hourLabel(s.hour)}–{hourLabel(s.hour + 1)}
                        {["pending", "confirmed", "balance_due"].includes(b.status) && b.slots.length > 1 && (
                          <button className="muted" style={{ background: "none", border: 0, marginLeft: 4 }} title="Remove this hour" onClick={() => removeHour(b.id, s.court_id, s.hour)}>
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    {b.equipment.map((e) => (
                      <div key={e.equipment_id} className="muted">
                        {e.name} × {e.qty}
                      </div>
                    ))}
                  </td>
                  <td>
                    <b>{money(b.total, sym)}</b>
                    {b.source === "admin" && <div className="muted">entered by admin</div>}
                    {b.partial_payment && b.partial_percent && b.status === "pending" && <div className="muted">guest chose {b.partial_percent}% deposit</div>}
                    {b.payments.map((p) => (
                      <div key={p.id} className="pay-line" title={`${p.recorded_by} · ${new Date(p.received_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}${p.note ? ` · ${p.note}` : ""}`}>
                        {METHOD_LABEL[p.method]} {money(p.amount, sym)}
                        {p.reference && <span className="mono"> #{p.reference}</span>}
                      </div>
                    ))}
                    {["confirmed", "balance_due"].includes(b.status) && Number(b.total) - b.paid > 0 && <div className="pay-due">Due {money(Number(b.total) - b.paid, sym)}</div>}
                  </td>
                  <td>
                    {b.receipt_path ? (
                      <button className="btn btn-outline btn-sm" onClick={() => setReceipt(`/api/files/${b.receipt_path}`)}>
                        View
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="actions">
                      {b.status === "pending" && (
                        <>
                          <button className="btn btn-primary btn-sm" disabled={busy === b.id} onClick={() => setPaying(b)}>
                            Record payment
                          </button>
                          <button className="btn btn-danger btn-sm" disabled={busy === b.id} onClick={() => act(b.id, "decline", prompt("Reason (optional)") || undefined)}>
                            Decline
                          </button>
                        </>
                      )}
                      {b.status === "balance_due" && (
                        <button className="btn btn-primary btn-sm" disabled={busy === b.id} onClick={() => setPaying(b)}>
                          Collect balance
                        </button>
                      )}
                      {b.status === "awaiting_payment" && b.slots.length > 0 && (
                        <button className="btn btn-primary btn-sm" disabled={busy === b.id} onClick={() => setPaying(b)} title="Guest paid but didn't upload a receipt">
                          Mark as paid
                        </button>
                      )}
                      {b.status === "declined" && (
                        <button className="btn btn-outline btn-sm" disabled={busy === b.id} onClick={() => act(b.id, "confirm")}>
                          Confirm anyway
                        </button>
                      )}
                      {["pending", "confirmed", "balance_due", "awaiting_payment"].includes(b.status) && (
                        <button className="btn btn-outline btn-sm" disabled={busy === b.id} onClick={() => confirm("Cancel this booking and free its hours?") && act(b.id, "cancel")}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {paying && (
        <PaymentDialog
          title={`${paying.status === "balance_due" ? "Collect balance" : "Record payment"} · ${paying.confirmation_id} · ${paying.guest_name}`}
          total={Number(paying.total)}
          paid={paying.paid}
          sym={sym}
          presets={presetsFor(paying)}
          onClose={() => setPaying(null)}
          onSubmit={(p) => pay(paying.id, p)}
        />
      )}
      {receipt && (
        <div className="lightbox" onClick={() => setReceipt(null)}>
          {receipt.endsWith(".pdf") ? (
            <iframe src={receipt} style={{ width: "90vw", height: "85vh", background: "#fff", borderRadius: 12 }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={receipt} alt="Receipt" />
          )}
          <button className="close" onClick={() => setReceipt(null)}>
            ✕
          </button>
        </div>
      )}
    </>
  );
}
