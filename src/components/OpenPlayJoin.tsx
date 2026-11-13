"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { scrollToId } from "./Header";
import { money } from "@/lib/format";
import { longDate, rangeLabel } from "@/lib/time";
import type { OpenPlayPublic, SiteConfig } from "@/lib/types";

/** Kept in step with MAX_PLAYERS_PER_JOIN in lib/openPlay.ts (a server module, so not imported here). */
const MAX_PER_JOIN = 8;

/** Fired by the homepage banner; the booking widget listens, jumps to the date and opens the join form. */
export const OPEN_PLAY_EVENT = "ck:open-play";

export function openPlayJoin(s: OpenPlayPublic) {
  window.dispatchEvent(new CustomEvent<OpenPlayPublic>(OPEN_PLAY_EVENT, { detail: s }));
}

export function OpenPlayBanner({ sessions, sym }: { sessions: OpenPlayPublic[]; sym: string }) {
  if (!sessions.length) return null;
  return (
    <section className="card op-banner" id="open-play">
      <h2>Join an open play session</h2>
      <p>Pay per player, meet other players, and jump straight into friendly games, no need to book a whole court.</p>
      <div className="op-list">
        {sessions.map((s) => {
          const left = Math.max(0, s.capacity - s.joined);
          return (
            <button
              key={s.id}
              className="op-item"
              disabled={!left}
              onClick={() => {
                openPlayJoin(s);
                scrollToId("book");
              }}
            >
              <b>{longDate(s.date).replace(/, \d{4}$/, "")}</b>
              <span>
                {rangeLabel(s.startHour, s.endHour)} · {s.courtName}
              </span>
              <span>
                {money(s.pricePerPlayer, sym)}/player · {left ? `${left} spot${left === 1 ? "" : "s"} left` : "Full"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function OpenPlayJoinModal({ cfg, session, onClose, onConflict }: { cfg: SiteConfig; session: OpenPlayPublic; onClose: () => void; onConflict: () => void }) {
  const router = useRouter();
  const sym = cfg.currencySymbol;
  const left = Math.max(0, session.capacity - session.joined);
  const maxPlayers = Math.min(left, MAX_PER_JOIN);
  const [players, setPlayers] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);
  const fee = cfg.bookingFee;
  const subtotal = session.pricePerPlayer * players;

  useEffect(() => {
    firstField.current?.focus();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setErr("Please enter your full name.");
    if (!/^[0-9+\-\s()]{7,20}$/.test(phone.trim())) return setErr("Please enter a valid contact number.");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr("Please enter a valid email address.");
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch("/api/open-play/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, players, guestName: name.trim(), guestPhone: phone.trim(), guestEmail: email.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j.code === "conflict") onConflict();
        setErr(j.error || "Something went wrong");
        return;
      }
      router.push(`/checkout/${j.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal aria-labelledby="op-title" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h3 id="op-title">Join Open Play</h3>
        <div className="receipt">
          <div className="line">
            <b>{longDate(session.date)}</b>
          </div>
          <div className="court-label">{session.courtName.toUpperCase()}</div>
          <div className="line">
            <span>{rangeLabel(session.startHour, session.endHour)}</span>
            <span>{left ? `${left} of ${session.capacity} spots left` : "Full"}</span>
          </div>
          {session.note && <p className="muted" style={{ margin: "6px 0 0" }}>{session.note}</p>}
          <div className="line" style={{ marginTop: 8 }}>
            <span>
              {players} player{players === 1 ? "" : "s"} × {money(session.pricePerPlayer, sym)}
            </span>
            <b>{money(subtotal, sym)}</b>
          </div>
          {fee > 0 && (
            <div className="line">
              <span>Processing fee</span>
              <b>{money(fee, sym)}</b>
            </div>
          )}
          <div className="total-line">
            <span>Total</span>
            <span>{money(subtotal + fee, sym)}</span>
          </div>
        </div>
        {err && <div className="error">{err}</div>}
        {maxPlayers > 0 ? (
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="op-players">Number of players</label>
              <select id="op-players" value={players} onChange={(e) => setPlayers(Number(e.target.value))}>
                {Array.from({ length: maxPlayers }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} player{n === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="op-name">
                Full Name <span className="req">*</span>
              </label>
              <input id="op-name" ref={firstField} placeholder="Juan dela Cruz" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="op-email">
                Email Address <span className="opt">(optional)</span>
              </label>
              <input id="op-email" type="email" placeholder="juandelacruz@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="op-phone">
                Contact Number <span className="req">*</span>
              </label>
              <input id="op-phone" type="tel" placeholder="0917..." value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </div>
            <p className="consent">
              By joining, you agree to our{" "}
              <a href="/#policies" target="_blank">
                Court Rules &amp; Policies
              </a>{" "}
              and consent to the collection and use of your information as described in our{" "}
              <a href="/privacy" target="_blank">
                Privacy Policy
              </a>
              .
            </p>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? "Reserving…" : `Reserve ${players} spot${players === 1 ? "" : "s"} · ${money(subtotal + fee, sym)}`}
            </button>
          </form>
        ) : (
          <button className="btn btn-muted btn-block" disabled>
            This session is full
          </button>
        )}
      </div>
    </div>
  );
}
