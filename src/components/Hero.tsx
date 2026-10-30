"use client";
import { useEffect, useState } from "react";
import { FactIcon, Ic } from "./Icons";
import type { SiteConfig } from "@/lib/types";

export default function Hero({ cfg, courtCount }: { cfg: SiteConfig; courtCount: number }) {
  const [lb, setLb] = useState<number | null>(null);
  const photos = cfg.gallery.length ? cfg.gallery : ["/images/hero.jpg"];
  const [first, ...rest] = cfg.courtName.split(" ");
  const facts = cfg.heroFacts.map((f) => ({ ...f, text: f.text || (f.icon === "pin" ? cfg.locationText : f.icon === "grid" ? `${courtCount} courts` : f.text) }));

  useEffect(() => {
    if (lb == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLb(null);
      if (e.key === "ArrowRight") setLb((i) => (i == null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setLb((i) => (i == null ? i : (i - 1 + photos.length) % photos.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lb, photos.length]);

  return (
    <>
      <section className="hero" id="home">
        <div className="hero-info">
          <div className="eyebrow">Book a pickleball court at</div>
          <h1>
            {first} <span>{rest.join(" ")}</span>
          </h1>
          {facts.map((f, i) => (
            <div className="hero-fact" key={i}>
              <span className="ic">
                <FactIcon name={f.icon} />
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{f.text}</span>
            </div>
          ))}
        </div>
        <div className="hero-main" onClick={() => setLb(0)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[0]} alt="Court view 1" />
        </div>
        <div className="hero-thumbs">
          {photos.slice(1, 4).map((p, i) => (
            <div className="hero-thumb" key={p} onClick={() => setLb(i + 1)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt={`Court view ${i + 2}`} />
              {i === 2 && (
                <button
                  className="show-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLb(0);
                  }}
                >
                  <Ic.Grid2x2 size={14} /> Show all photos
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      <div className="meta-row">
        <span>
          <Ic.MapPin size={15} /> {cfg.locationText}
        </span>
        <span>
          <Ic.Clock size={15} /> {cfg.slotMinutes}-min slots
        </span>
      </div>
      {lb != null && (
        <div className="lightbox" onClick={() => setLb(null)}>
          <button className="close" aria-label="Close" onClick={() => setLb(null)}>
            ✕
          </button>
          <button
            className="nav-btn left"
            aria-label="Previous"
            onClick={(e) => {
              e.stopPropagation();
              setLb((lb - 1 + photos.length) % photos.length);
            }}
          >
            <Ic.ChevronLeft />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[lb]} alt={`Court view ${lb + 1}`} onClick={(e) => e.stopPropagation()} />
          <button
            className="nav-btn right"
            aria-label="Next"
            onClick={(e) => {
              e.stopPropagation();
              setLb((lb + 1) % photos.length);
            }}
          >
            <Ic.ChevronRight />
          </button>
          <div className="counter">
            {lb + 1} / {photos.length}
          </div>
        </div>
      )}
    </>
  );
}
