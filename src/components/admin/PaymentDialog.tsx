"use client";
import { useState } from "react";
import { money } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";

export const METHODS: [PaymentMethod, string][] = [
  ["gcash", "GCash"],
  ["cash", "Cash"],
  ["bank", "Bank transfer"],
  ["other", "Other"],
];
export const METHOD_LABEL = Object.fromEntries(METHODS) as Record<PaymentMethod, string>;

export type PaymentValue = { amount: number; method: PaymentMethod; reference?: string; note?: string };

/** Amount, method and GCash reference fields; shared by the record-payment dialog and the new-booking form. */
export function PaymentFields({ value, onChange, sym, presets }: { value: PaymentValue; onChange: (v: PaymentValue) => void; sym: string; presets?: [string, number][] }) {
  return (
    <div className="pay-fields">
      {presets && presets.length > 0 && (
        <div className="pay-presets">
          {presets.map(([label, amt]) => (
            <button type="button" key={label} className={`btn btn-sm ${value.amount === amt ? "btn-primary" : "btn-outline"}`} onClick={() => onChange({ ...value, amount: amt })}>
              {label} {money(amt, sym)}
            </button>
          ))}
        </div>
      )}
      <label>
        Amount received
        <input type="number" inputMode="decimal" min={0} step="any" value={Number.isFinite(value.amount) ? value.amount : ""} onChange={(e) => onChange({ ...value, amount: Number(e.target.value) })} required />
      </label>
      <label>
        Paid via
        <div className="pay-methods">
          {METHODS.map(([k, l]) => (
            <button type="button" key={k} className={`btn btn-sm ${value.method === k ? "btn-primary" : "btn-outline"}`} onClick={() => onChange({ ...value, method: k })}>
              {l}
            </button>
          ))}
        </div>
      </label>
      {value.method !== "cash" && (
        <label>
          {value.method === "gcash" ? "GCash reference no." : "Reference no."} <span className="muted">(optional)</span>
          <input value={value.reference ?? ""} onChange={(e) => onChange({ ...value, reference: e.target.value })} placeholder={value.method === "gcash" ? "e.g. 1012 345 678901" : ""} maxLength={80} />
        </label>
      )}
    </div>
  );
}

export default function PaymentDialog({
  title,
  total,
  paid,
  sym,
  presets,
  onClose,
  onSubmit,
}: {
  title: string;
  total: number;
  paid: number;
  sym: string;
  presets: [string, number][];
  onClose: () => void;
  onSubmit: (p: PaymentValue) => Promise<string | null>;
}) {
  const due = Math.max(total - paid, 0);
  const [v, setV] = useState<PaymentValue>({ amount: presets[0]?.[1] ?? due, method: "gcash" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const after = paid + (v.amount || 0);

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="modal pay-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(await onSubmit(v));
          setBusy(false);
        }}
      >
        <h3>{title}</h3>
        <div className="pay-summary">
          <span>
            Total <b>{money(total, sym)}</b>
          </span>
          <span>
            Paid <b>{money(paid, sym)}</b>
          </span>
          <span>
            Due <b>{money(due, sym)}</b>
          </span>
        </div>
        <PaymentFields value={v} onChange={setV} sym={sym} presets={presets} />
        <label>
          Note <span className="muted">(optional)</span>
          <input value={v.note ?? ""} onChange={(e) => setV({ ...v, note: e.target.value })} maxLength={300} />
        </label>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          {after >= total ? "Booking will be marked Confirmed (fully paid)." : `Booking will be marked Balance Due with ${money(total - after, sym)} left to collect.`}
        </p>
        {err && <div className="error">{err}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary btn-sm" disabled={busy || !(v.amount > 0)}>
            {busy ? "Saving…" : "Save payment"}
          </button>
        </div>
      </form>
    </div>
  );
}
