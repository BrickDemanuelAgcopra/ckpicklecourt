"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Court, RateBand, SiteConfig } from "@/lib/types";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Setter = <K extends keyof SiteConfig>(k: K, v: SiteConfig[K]) => void;
function Text({ cfg, set, k, label, type = "text" }: { cfg: SiteConfig; set: Setter; k: keyof SiteConfig; label: string; type?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type={type} value={String(cfg[k] ?? "")} onChange={(e) => set(k, (type === "number" ? Number(e.target.value) : e.target.value) as never)} />
    </div>
  );
}
function Check({ cfg, set, k, label }: { cfg: SiteConfig; set: Setter; k: keyof SiteConfig; label: string }) {
  return (
    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, marginBottom: 10 }}>
      <input type="checkbox" checked={Boolean(cfg[k])} onChange={(e) => set(k, e.target.checked as never)} /> {label}
    </label>
  );
}

export default function SettingsForm({ cfg: initial, courts: initialCourts, bands: initialBands }: { cfg: SiteConfig; courts: Court[]; bands: RateBand[] }) {
  const router = useRouter();
  const [cfg, setCfg] = useState(initial);
  const [courts, setCourts] = useState(initialCourts.map((c) => ({ ...c })));
  const [bands, setBands] = useState(initialBands.map((b) => ({ ...b })));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const post = async (body: unknown) => {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    setBusy(false);
    setMsg(r.ok ? "Saved." : j.error || "Failed");
    if (r.ok) router.refresh();
  };
  const upload = async (kind: "qr" | "qr2" | "logo", file: File) => {
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", file);
    const r = await fetch("/api/admin/settings", { method: "POST", body: fd });
    const j = await r.json();
    setMsg(r.ok ? "Uploaded." : j.error);
    if (r.ok) {
      if (kind === "qr") setCfg({ ...cfg, payment: { ...cfg.payment, qrUrl: j.url } });
      else if (kind === "qr2") setCfg({ ...cfg, paymentAlt: { ...alt, qrUrl: j.url } });
      else setCfg({ ...cfg, logoUrl: j.url });
      router.refresh();
    }
  };
  const alt = cfg.paymentAlt ?? { bankName: "Maya", accountName: cfg.payment.accountName, accountNumber: "", qrUrl: "" };
  const set = <K extends keyof SiteConfig>(k: K, v: SiteConfig[K]) => setCfg({ ...cfg, [k]: v });
  const saveConfig = () => {
    const { courtName, tagline, locationText, mapsUrl, contactNumber, emailAddress, facebookPage, openingHoursText, bookingWindowDays, bookingFee, bookingFeePerHour, paymentWindowMinutes, partialPaymentEnabled, partialPaymentPercent, emailSendingEnabled, adminEmail, showRateSeparators, payment, paymentAlt, courtDetails, policies, faqs, gallery } = cfg;
    post({ op: "config", config: { courtName, tagline, locationText, mapsUrl, contactNumber, emailAddress, facebookPage, openingHoursText, bookingWindowDays, bookingFee, bookingFeePerHour, paymentWindowMinutes, partialPaymentEnabled, partialPaymentPercent, emailSendingEnabled, adminEmail, showRateSeparators, payment, paymentAlt, courtDetails, policies, faqs, gallery } });
  };

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 820 }}>
      {msg && <div className="note">{msg}</div>}

      <section className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Club</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          <Text cfg={cfg} set={set} k="courtName" label="Club name" />
          <Text cfg={cfg} set={set} k="tagline" label="Tagline" />
          <Text cfg={cfg} set={set} k="locationText" label="Address" />
          <Text cfg={cfg} set={set} k="mapsUrl" label="Google Maps link" />
          <Text cfg={cfg} set={set} k="contactNumber" label="Contact number" />
          <Text cfg={cfg} set={set} k="emailAddress" label="Email address" />
          <Text cfg={cfg} set={set} k="facebookPage" label="Facebook page URL" />
          <Text cfg={cfg} set={set} k="openingHoursText" label="Opening hours line" />
        </div>
        <div className="field">
          <label>Logo</label>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cfg.logoUrl} alt="" style={{ width: 56, height: 56, borderRadius: "50%" }} />
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload("logo", e.target.files[0])} />
          </div>
        </div>
        <div className="field">
          <label>Gallery image URLs (one per line; first is the hero)</label>
          <textarea rows={5} value={cfg.gallery.join("\n")} onChange={(e) => set("gallery", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))} />
        </div>
      </section>

      <section className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Booking rules</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          <Text cfg={cfg} set={set} k="bookingWindowDays" label="Booking window (days ahead)" type="number" />
          <Text cfg={cfg} set={set} k="paymentWindowMinutes" label="Minutes to upload receipt" type="number" />
          <Text cfg={cfg} set={set} k="bookingFee" label="Processing fee" type="number" />
          <Text cfg={cfg} set={set} k="partialPaymentPercent" label="Partial payment %" type="number" />
          <Text cfg={cfg} set={set} k="adminEmail" label="Admin notification email" />
        </div>
        <Check cfg={cfg} set={set} k="bookingFeePerHour" label="Charge processing fee per court per hour (instead of per reservation)" />
        <Check cfg={cfg} set={set} k="partialPaymentEnabled" label="Allow guests to pay a partial amount and settle the balance at the court" />
        <Check cfg={cfg} set={set} k="emailSendingEnabled" label="Send booking emails: receipts received, confirmations, payments, cancellations, day-before reminders, and a 7 AM daily summary to the admin notification email (needs SMTP settings in .env)" />
        <Check cfg={cfg} set={set} k="showRateSeparators" label="Show rate-band separators in the grid" />
      </section>

      <section className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Payment</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          {(["bankName", "accountName", "accountNumber"] as const).map((k) => (
            <div className="field" key={k}>
              <label>{k === "bankName" ? "Bank / wallet (e.g. GCash)" : k === "accountName" ? "Account name" : "Account number"}</label>
              <input value={cfg.payment[k]} onChange={(e) => set("payment", { ...cfg.payment, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <div className="field">
          <label>Payment QR image</label>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cfg.payment.qrUrl} alt="" style={{ width: 80, height: 80, borderRadius: 8, background: "#fff", border: "1px solid var(--ck-line)" }} />
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload("qr", e.target.files[0])} />
          </div>
        </div>
        <h3 style={{ fontSize: 14, margin: "16px 0 6px" }}>Second option (shown as a tab at checkout)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
          {(["bankName", "accountName", "accountNumber"] as const).map((k) => (
            <div className="field" key={k}>
              <label>{k === "bankName" ? "Wallet (e.g. Maya)" : k === "accountName" ? "Account name" : "Account number (optional)"}</label>
              <input value={alt[k]} onChange={(e) => set("paymentAlt", { ...alt, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <div className="field">
          <label>Second QR image</label>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {alt.qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={alt.qrUrl} alt="" style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 8, background: "#fff", border: "1px solid var(--ck-line)" }} />
            ) : (
              <span className="muted">None — only the first option is shown</span>
            )}
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload("qr2", e.target.files[0])} />
            {alt.qrUrl && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => set("paymentAlt", { ...alt, qrUrl: "" })}>
                Remove
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Content</h2>
        {(["courtDetails", "policies"] as const).map((k) => (
          <div key={k}>
            <h3 style={{ fontSize: 14, margin: "10px 0 6px" }}>{k === "courtDetails" ? "Court details" : "Reminders / policies"}</h3>
            {cfg[k].map((it, i) => (
              <div key={it.id} style={{ display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 8, marginBottom: 8 }}>
                <input value={it.title} onChange={(e) => set(k, cfg[k].map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} style={{ border: "1px solid var(--ck-line)", borderRadius: 8, padding: 8 }} />
                <textarea rows={2} value={it.text} onChange={(e) => set(k, cfg[k].map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} style={{ border: "1px solid var(--ck-line)", borderRadius: 8, padding: 8 }} />
                <button className="btn btn-outline btn-sm" onClick={() => set(k, cfg[k].filter((_, j) => j !== i))}>
                  ✕
                </button>
              </div>
            ))}
            <button className="btn btn-outline btn-sm" onClick={() => set(k, [...cfg[k], { id: `item-${Date.now()}`, title: "", text: "" }])}>
              + Add
            </button>
          </div>
        ))}
        <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>FAQ</h3>
        {cfg.faqs.map((f, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8 }}>
            <input value={f.q} placeholder="Question" onChange={(e) => set("faqs", cfg.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} style={{ border: "1px solid var(--ck-line)", borderRadius: 8, padding: 8 }} />
            <textarea rows={2} value={f.a} placeholder="Answer" onChange={(e) => set("faqs", cfg.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} style={{ border: "1px solid var(--ck-line)", borderRadius: 8, padding: 8 }} />
            <button className="btn btn-outline btn-sm" onClick={() => set("faqs", cfg.faqs.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button className="btn btn-outline btn-sm" onClick={() => set("faqs", [...cfg.faqs, { q: "", a: "" }])}>
          + Add FAQ
        </button>
      </section>

      <button className="btn btn-primary" disabled={busy} onClick={saveConfig}>
        Save club settings
      </button>

      <section className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Courts</h2>
        {courts.map((c, i) => (
          <div key={c.id ?? `new-${i}`} style={{ display: "grid", gridTemplateColumns: "1fr 120px auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input value={c.name} onChange={(e) => setCourts(courts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} style={{ border: "1px solid var(--ck-line)", borderRadius: 8, padding: 8 }} />
            <select value={c.kind} onChange={(e) => setCourts(courts.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))} style={{ border: "1px solid var(--ck-line)", borderRadius: 8, padding: 8 }}>
              <option value="outdoor">outdoor</option>
              <option value="indoor">indoor</option>
            </select>
            <label style={{ fontSize: 13 }}>
              <input type="checkbox" checked={c.available} onChange={(e) => setCourts(courts.map((x, j) => (j === i ? { ...x, available: e.target.checked } : x)))} /> available
            </label>
          </div>
        ))}
        <div className="actions">
          <button className="btn btn-outline btn-sm" onClick={() => setCourts([...courts, { id: 0, name: `Court ${courts.length + 1}`, kind: "outdoor", available: true, sort: courts.length + 1 }])}>
            + Add court
          </button>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => post({ op: "courts", courts: courts.map((c) => ({ id: c.id || undefined, name: c.name, kind: c.kind, available: c.available })) })}>
            Save courts
          </button>
        </div>
      </section>

      <section className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>Rate bands</h2>
        <p className="muted" style={{ marginBottom: 10 }}>Hours outside every band are not bookable. End hour 24 = midnight. Leave days empty for every day.</p>
        {bands.map((b, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 90px 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input value={b.name} placeholder="Name" onChange={(e) => setBands(bands.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} style={{ border: "1px solid var(--ck-line)", borderRadius: 8, padding: 8 }} />
            <input type="number" min={0} max={23} value={b.start_hour} onChange={(e) => setBands(bands.map((x, j) => (j === i ? { ...x, start_hour: Number(e.target.value) } : x)))} style={{ border: "1px solid var(--ck-line)", borderRadius: 8, padding: 8 }} />
            <input type="number" min={1} max={24} value={b.end_hour} onChange={(e) => setBands(bands.map((x, j) => (j === i ? { ...x, end_hour: Number(e.target.value) } : x)))} style={{ border: "1px solid var(--ck-line)", borderRadius: 8, padding: 8 }} />
            <input type="number" min={0} value={b.price} onChange={(e) => setBands(bands.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))} style={{ border: "1px solid var(--ck-line)", borderRadius: 8, padding: 8 }} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", fontSize: 11 }}>
              {DOW.map((d, di) => (
                <label key={d} style={{ display: "inline-flex", gap: 2 }}>
                  <input type="checkbox" checked={b.days.includes(di)} onChange={(e) => setBands(bands.map((x, j) => (j === i ? { ...x, days: e.target.checked ? [...x.days, di] : x.days.filter((y) => y !== di) } : x)))} />
                  {d}
                </label>
              ))}
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setBands(bands.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <div className="actions">
          <button className="btn btn-outline btn-sm" onClick={() => setBands([...bands, { id: 0, name: "", start_hour: 6, end_hour: 12, price: 0, days: [], sort: bands.length + 1 }])}>
            + Add band
          </button>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => post({ op: "bands", bands: bands.map(({ name, start_hour, end_hour, price, days }) => ({ name, start_hour, end_hour, price, days })) })}>
            Save rate bands
          </button>
        </div>
      </section>
    </div>
  );
}
