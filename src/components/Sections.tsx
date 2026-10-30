"use client";
import { useState } from "react";
import { Ic } from "./Icons";
import { money } from "@/lib/format";
import { rangeLabel } from "@/lib/time";
import type { Equipment, RateBand, SiteConfig } from "@/lib/types";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Rates({ bands, sym }: { bands: RateBand[]; sym: string }) {
  return (
    <section className="card rates" id="rates">
      <div className="eyebrow rates-title">Court rates</div>
      {bands.map((b) => (
        <div className="rate-row" key={b.id}>
          <b>
            {rangeLabel(b.start_hour, b.end_hour)}
            {b.days?.length ? <small>{b.days.map((d) => DOW[d]).join(", ")}</small> : null}
          </b>
          <div style={{ textAlign: "right" }}>
            <small>All courts</small>
            <strong>{money(b.price, sym)}/hr</strong>
          </div>
        </div>
      ))}
    </section>
  );
}

export function CourtInfo({ cfg, bands, equipment }: { cfg: SiteConfig; bands: RateBand[]; equipment: Equipment[] }) {
  const [open, setOpen] = useState<number>(0);
  const sym = cfg.currencySymbol;
  const items = [
    {
      title: "1. Court hours",
      id: "facilities",
      body: (
        <>
          <p>{cfg.openingHoursText.replace(/^Open /, "We are open ")}.</p>
          <p>
            <strong>All courts</strong>: {bands.map((b) => `${money(b.price, sym)}/hr (${rangeLabel(b.start_hour, b.end_hour)})`).join(" · ")}
          </p>
          {equipment.length > 0 && (
            <>
              <p>
                <strong>Add-ons:</strong>
              </p>
              <ul>
                {equipment.map((e) => (
                  <li key={e.id}>
                    {e.name} rental ({money(e.price, sym)} / {e.unit})
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ),
    },
    {
      title: "2. Location",
      id: "location",
      body: (
        <p>
          We are located at: {cfg.locationText}.{" "}
          <a href={cfg.mapsUrl} target="_blank" rel="noreferrer">
            View on Google Maps
          </a>
          .
        </p>
      ),
    },
    {
      title: "3. Court Details",
      id: "court-details",
      body: (
        <ul>
          {cfg.courtDetails.map((d) => (
            <li key={d.id}>
              <strong>{d.title}: </strong>
              <span style={{ whiteSpace: "pre-line" }}>{d.text}</span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: "4. Reminders/Policies",
      id: "policies",
      body: (
        <>
          {cfg.policies.map((p) => (
            <div key={p.id}>
              <h5>{p.title}</h5>
              <p style={{ whiteSpace: "pre-line" }}>{p.text}</p>
            </div>
          ))}
        </>
      ),
    },
  ];
  return (
    <section className="info" id="info">
      <h2>Court Information</h2>
      {items.map((it, i) => (
        <div className="acc" key={it.title} id={it.id}>
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
            <span>{it.title}</span>
            <span style={{ transform: open === i ? "rotate(90deg)" : "none", transition: "transform .15s", display: "inline-flex" }}>
              <Ic.ChevronRight size={16} />
            </span>
          </button>
          {open === i && <div className="body">{it.body}</div>}
        </div>
      ))}
      {cfg.faqs.length > 0 && (
        <div id="faq" style={{ marginTop: 22 }}>
          <h2>FAQ</h2>
          {cfg.faqs.map((f, i) => (
            <FaqItem key={i} q={f.q} a={f.a} />
          ))}
        </div>
      )}
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [o, setO] = useState(false);
  return (
    <div className="acc">
      <button type="button" aria-expanded={o} onClick={() => setO(!o)}>
        <span>{q}</span>
        <span style={{ transform: o ? "rotate(90deg)" : "none", display: "inline-flex" }}>
          <Ic.ChevronRight size={16} />
        </span>
      </button>
      {o && (
        <div className="body">
          <p>{a}</p>
        </div>
      )}
    </div>
  );
}

export function OpenPlayBanner({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <section className="card" id="open-play" style={{ padding: 20, marginTop: 18, background: "var(--ck-green)", color: "#fff" }}>
      <h2 style={{ color: "var(--ck-gold)", fontSize: 18 }}>Join an open play session</h2>
      <p style={{ margin: "6px 0 0", opacity: 0.85 }}>Pay per player, meet other players, and jump straight into friendly games — no need to book a whole court. Look for the Open Play slots in the grid.</p>
    </section>
  );
}
