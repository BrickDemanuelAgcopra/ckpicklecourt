"use client";

import { useEffect, useRef, useState } from "react";

type Point = { key: string; label: string; revenue: number; bookings: number; hours: number };

const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}
const compact = (sym: string, v: number) => (v >= 1000 ? `${sym}${(v / 1000).toLocaleString("en-PH", { maximumFractionDigits: 1 })}k` : `${sym}${v}`);

/** Revenue over time: 2px line on a 10% area wash, hover crosshair + tooltip. */
export default function TrendChart({ points, sym, unit }: { points: Point[]; sym: string; unit: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = niceMax(Math.max(...points.map((p) => p.revenue), 0));
  const iw = w - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length <= 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.revenue).toFixed(1)}`).join("");
  const area = points.length ? `${line}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : "";
  const divs = max / 10 ** Math.floor(Math.log10(max)) === 2 ? 4 : 5; // keep tick steps round
  const ticks = Array.from({ length: divs + 1 }, (_, i) => (i * max) / divs);
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 70))));
  const peak = points.reduce((best, p, i) => (p.revenue > (points[best]?.revenue ?? -1) ? i : best), 0);

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - r.left) / r.width;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(rel * (points.length - 1)))));
  }

  const hp = hover != null ? points[hover] : null;
  if (!w) return <div ref={ref} className="viz-trend" style={{ height: H }} />;
  return (
    <div ref={ref} className="viz-trend">
      <svg width={w} height={H} role="img" aria-label={`Revenue per ${unit}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} className={t ? "viz-grid" : "viz-base"} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="viz-tick">
              {compact(sym, t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % every === 0 ? (
            <text key={p.key} x={x(i)} y={H - 8} textAnchor="middle" className="viz-tick">
              {p.label}
            </text>
          ) : null
        )}
        <path d={area} className="viz-area" />
        <path d={line} className="viz-line" />
        {points[peak]?.revenue > 0 && hover == null && (
          <>
            <circle cx={x(peak)} cy={y(points[peak].revenue)} r={4.5} className="viz-dot" />
            <text x={x(peak)} y={y(points[peak].revenue) - 10} textAnchor={peak > points.length * 0.8 ? "end" : "middle"} className="viz-label">
              Peak {sym}
              {points[peak].revenue.toLocaleString("en-PH")}
            </text>
          </>
        )}
        {hp && (
          <>
            <line x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={PAD.top + ih} className="viz-cross" />
            <circle cx={x(hover!)} cy={y(hp.revenue)} r={4.5} className="viz-dot" />
          </>
        )}
        <rect x={PAD.left} y={PAD.top} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hp && (
        <div className="viz-tip" style={{ left: Math.min(Math.max(x(hover!), 90), w - 90), top: Math.max(y(hp.revenue) - 12, 0) }}>
          <b>
            {unit === "day" ? "" : unit === "week" ? "Week of " : ""}
            {hp.label}
          </b>
          <div>
            Revenue <span>{sym}{hp.revenue.toLocaleString("en-PH")}</span>
          </div>
          <div>
            Bookings <span>{hp.bookings}</span>
          </div>
          <div>
            Court hours <span>{hp.hours}</span>
          </div>
        </div>
      )}
    </div>
  );
}
