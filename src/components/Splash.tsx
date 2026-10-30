"use client";
import { useEffect, useState } from "react";
import { CourtOutline } from "./Icons";

export default function Splash({ name, logoUrl }: { name: string; logoUrl: string }) {
  // Shown once per browser session, and never when arriving via /?book=1
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("ck-splash") || new URLSearchParams(location.search).has("book")) return;
      sessionStorage.setItem("ck-splash", "1");
    } catch {
      /* ignore */
    }
    // starts false on the server so hydration matches, then flips on after mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true);
    const t = setTimeout(() => setShow(false), 2100);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="splash" aria-hidden>
      <div style={{ textAlign: "center" }}>
        <CourtOutline className="court" />
        <div className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" />
        </div>
        <div className="eyebrow" style={{ marginTop: 56, opacity: 0.8 }}>
          Welcome to
        </div>
        <h1>{name}</h1>
        <div className="eyebrow" style={{ opacity: 0.6, fontSize: 10 }}>
          Pickleball Club
        </div>
      </div>
    </div>
  );
}
