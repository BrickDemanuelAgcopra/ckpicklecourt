"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ic } from "./Icons";

export const NAV = [
  { id: "home", label: "Home" },
  { id: "rates", label: "Rates" },
  { id: "facilities", label: "Facilities" },
  { id: "open-play", label: "Open Play" },
  { id: "location", label: "Location" },
  { id: "faq", label: "FAQ" },
];

export function scrollToId(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

export default function Header({ name, logoUrl, onTrack }: { name: string; logoUrl: string; onTrack?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const go = (id: string) => {
    setOpen(false);
    if (!scrollToId(id)) router.push(`/#${id}`);
  };
  const track = () => {
    setOpen(false);
    if (onTrack) onTrack();
    else router.push("/bookings");
  };
  return (
    <header className="site-header">
      <div className="container inner">
        <Link href="/" className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" />
          <span>{name}</span>
        </Link>
        <nav className="nav">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)}>
              {n.label}
            </button>
          ))}
          <button onClick={track}>Track Booking</button>
          <button className="btn btn-gold btn-sm" style={{ padding: "9px 18px" }} onClick={() => go("book")}>
            Book a Court
          </button>
        </nav>
        <button className="nav-toggle" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
          {open ? <Ic.X /> : <Ic.Menu />}
        </button>
      </div>
      {open && (
        <div className="nav-mobile">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)}>
              {n.label}
            </button>
          ))}
          <button onClick={track}>Track Booking</button>
          <button onClick={() => go("book")} style={{ color: "var(--ck-gold)" }}>
            Book a Court
          </button>
        </div>
      )}
    </header>
  );
}

export function Footer({ name }: { name: string }) {
  return (
    <footer className="site-footer">
      <span>© {new Date().getFullYear()} {name} Booking System</span>
      <span className="ver">v1.0.0</span>
    </footer>
  );
}
