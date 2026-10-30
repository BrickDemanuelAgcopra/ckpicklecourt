"use client";
import { useEffect, useState } from "react";
import Header, { Footer } from "./Header";
import TrackBooking from "./TrackBooking";
import type { SiteConfig } from "@/lib/types";

/** Header + footer + Track Booking modal shared by every public page. */
export default function PublicShell({ cfg, children }: { cfg: SiteConfig; children: React.ReactNode }) {
  const [track, setTrack] = useState(false);
  useEffect(() => {
    if (!track) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setTrack(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [track]);
  return (
    <>
      <Header name={cfg.courtName} logoUrl={cfg.logoUrl} onTrack={() => setTrack(true)} />
      <main className="container" style={{ paddingTop: 22 }}>
        {children}
      </main>
      <Footer name={cfg.courtName} facebook={cfg.facebookPage} motto={cfg.motto} />
      {track && (
        <div className="overlay" onClick={() => setTrack(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setTrack(false)}>
              ×
            </button>
            <TrackBooking logoUrl={cfg.logoUrl} sym={cfg.currencySymbol} onClose={() => setTrack(false)} />
          </div>
        </div>
      )}
    </>
  );
}
