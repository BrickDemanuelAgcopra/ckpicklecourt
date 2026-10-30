"use client";
import { useEffect, useState } from "react";
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
            {b.name && <small className="band-name">{b.name}</small>}
            {rangeLabel(b.start_hour, b.end_hour)}
            {b.days?.length ? <small>{b.days.map((d) => DOW[d]).join(", ")}</small> : null}
          </b>
          <div style={{ textAlign: "right" }}>
            <small>Per court</small>
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
          <ul>
            {bands.map((b) => (
              <li key={b.id}>
                <strong>{b.name}</strong> ({rangeLabel(b.start_hour, b.end_hour)}): {money(b.price, sym)}/hr per court
              </li>
            ))}
          </ul>
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
        <>
          <p>You'll find us at {cfg.locationText}.</p>
          <p>
            <a href={cfg.mapsUrl} target="_blank" rel="noreferrer">
              Get directions on Google Maps
            </a>
            {cfg.facebookPage && (
              <>
                {" · "}
                <a href={cfg.facebookPage} target="_blank" rel="noreferrer">
                  Message us on Facebook
                </a>
              </>
            )}
          </p>
        </>
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
      title: "4. Court Rules & Policies",
      id: "policies",
      body: (
        <>
          <ol className="rules">
            {cfg.policies.map((p) => (
              <li key={p.id}>
                <h5>{p.title}</h5>
                <RichText text={p.text} />
              </li>
            ))}
          </ol>
          {cfg.motto && <p className="motto">{cfg.motto}</p>}
        </>
      ),
    },
  ];

  // Expand the section a nav link or /#hash points at.
  useEffect(() => {
    const ids = items.map((it) => it.id);
    const openId = (id: string) => {
      const i = ids.indexOf(id);
      if (i >= 0) setOpen(i);
    };
    const onSection = (e: Event) => openId((e as CustomEvent<string>).detail);
    if (location.hash) {
      openId(location.hash.slice(1));
      const el = document.getElementById(location.hash.slice(1));
      if (el) setTimeout(() => el.scrollIntoView({ block: "start" }), 50);
    }
    window.addEventListener("ck:section", onSection);
    return () => window.removeEventListener("ck:section", onSection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

/** Plain text where lines starting with "• " become a bullet list. */
function RichText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) blocks.push(<ul key={blocks.length}>{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>);
    bullets = [];
  };
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*[•\-]\s+(.*)$/);
    if (m) bullets.push(m[1]);
    else {
      flush();
      if (line.trim()) blocks.push(<p key={blocks.length}>{line}</p>);
    }
  }
  flush();
  return <>{blocks}</>;
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
