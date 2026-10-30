import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { getConfig } from "@/lib/config";
import { expireOverdueHolds } from "@/lib/bookings";
import { earliestPlayDate, getAnalytics, RANGES, resolveRange, type BarRow, type Kpis } from "@/lib/analytics";
import { hourParts, longDate } from "@/lib/time";
import TrendChart from "@/components/admin/TrendChart";
import "./analytics.css";

export const dynamic = "force-dynamic";

const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;
const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WD_INDEX = [1, 2, 3, 4, 5, 6, 0];

function minutes(m: number | null) {
  if (m == null) return "—";
  if (m < 60) return `${Math.round(m)} min`;
  if (m < 60 * 24) return `${(m / 60).toFixed(1)} hrs`;
  return `${(m / 1440).toFixed(1)} days`;
}

function Delta({ cur, prev, kind = "pct" }: { cur: number; prev: number; kind?: "pct" | "pts" }) {
  if (kind === "pts") {
    const d = (cur - prev) * 100;
    if (Math.abs(d) < 0.05) return <span className="kpi-delta flat">— same as prior period</span>;
    return <span className={`kpi-delta ${d > 0 ? "up" : "down"}`}>{d > 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)} pts vs prior</span>;
  }
  if (!prev) return <span className="kpi-delta flat">{cur ? "new vs empty prior period" : "— no data in prior period"}</span>;
  const d = (cur - prev) / prev;
  if (Math.abs(d) < 0.005) return <span className="kpi-delta flat">— same as prior period</span>;
  return <span className={`kpi-delta ${d > 0 ? "up" : "down"}`}>{d > 0 ? "▲" : "▼"} {Math.abs(d * 100).toFixed(0)}% vs prior</span>;
}

function Kpi({ label, value, children, hint }: { label: string; value: string; children?: React.ReactNode; hint?: string }) {
  return (
    <div className="kpi" title={hint}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {children}
    </div>
  );
}

function Panel({ title, sub, children, wide }: { title: string; sub?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`panel${wide ? " wide" : ""}`}>
      <h2>{title}</h2>
      {sub && <p className="panel-sub">{sub}</p>}
      {children}
    </section>
  );
}

/** Horizontal bars, value at the tip; the bar is a single hue so text carries identity. */
function Bars({ rows, fmt, tone = "green" }: { rows: (BarRow & { extra?: string })[]; fmt: (v: number) => string; tone?: "green" | "gold" | "blue" }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (!max) return <p className="empty">No data in this period.</p>;
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.label} title={`${r.label}: ${fmt(r.value)}${r.sub ? ` · ${r.sub}` : ""}${r.extra ? ` · ${r.extra}` : ""}`}>
          <div className="bar-label">
            {r.label}
            {r.sub && <small>{r.sub}</small>}
          </div>
          <div className="bar-track">
            <div className={`bar-fill ${tone}`} style={{ width: `${(r.value / max) * 100}%` }} />
            <span className="bar-value">{fmt(r.value)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Vertical columns for small ordered distributions (lead time, session length). */
function Columns({ rows, total }: { rows: BarRow[]; total: number }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (!max) return <p className="empty">No data in this period.</p>;
  return (
    <div className="cols" role="img">
      {rows.map((r) => (
        <div className="col" key={r.label} title={`${r.label}: ${r.value} bookings (${pct(total ? r.value / total : 0)})`}>
          <div className="col-plot">
            <span className="col-value">{r.value ? pct(total ? r.value / total : 0) : ""}</span>
            <div className="col-fill" style={{ height: `${(r.value / max) * 100}%` }} />
          </div>
          <div className="col-label">{r.label}</div>
        </div>
      ))}
    </div>
  );
}

function Heatmap({ hours, cells }: { hours: number[]; cells: { booked: number; capacity: number }[][] }) {
  if (!hours.length) return <p className="empty">No rate bands set, so there are no bookable hours.</p>;
  return (
    <div className="heat-wrap">
      <div className="heat" style={{ gridTemplateColumns: `38px repeat(${hours.length}, minmax(26px, 1fr))` }}>
        <div />
        {hours.map((h) => {
          const p = hourParts(h);
          return (
            <div key={h} className="heat-h">
              {p.time.replace(":00", "")}
              <small>{p.suffix === "MN" ? "AM" : p.suffix}</small>
            </div>
          );
        })}
        {WD.map((d, r) => (
          <div key={d} style={{ display: "contents" }}>
            <div className="heat-d">{d}</div>
            {hours.map((h, i) => {
              const c = cells[WD_INDEX[r]][i];
              if (!c.capacity) return <div key={h} className="heat-c closed" title={`${d} ${hourParts(h).time} ${hourParts(h).suffix}: closed`} />;
              const occ = c.booked / c.capacity;
              const step = occ === 0 ? 0 : Math.min(5, Math.ceil(occ * 5));
              return (
                <div key={h} className={`heat-c s${step}`} tabIndex={0}>
                  <span className="heat-tip">
                    <b>
                      {d} {hourParts(h).time} {hourParts(h).suffix}
                    </b>
                    {pct(occ)} full · {c.booked} of {c.capacity} court-hours
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="heat-legend">
        <span>Empty</span>
        {[0, 1, 2, 3, 4, 5].map((s) => (
          <i key={s} className={`heat-c s${s}`} />
        ))}
        <span>Full</span>
        <i className="heat-c closed" style={{ marginLeft: 12 }} />
        <span>Closed</span>
      </div>
    </div>
  );
}

function MixBar({ parts, money }: { parts: { label: string; value: number; tone: string }[]; money: (v: number) => string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <p className="empty">No revenue in this period.</p>;
  return (
    <>
      <div className="mix">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <div key={p.label} className={`mix-seg ${p.tone}`} style={{ flexGrow: p.value }} title={`${p.label}: ${money(p.value)} (${pct(p.value / total)})`} />
          ))}
      </div>
      <ul className="mix-legend">
        {parts.map((p) => (
          <li key={p.label}>
            <i className={p.tone} />
            {p.label}
            <b>{money(p.value)}</b>
            <span>{pct(p.value / total)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Funnel({ f }: { f: { started: number; submitted: number; confirmed: number; expired: number; declined: number; cancelled: number; open: number } }) {
  if (!f.started) return <p className="empty">No checkouts were started in this period.</p>;
  const steps = [
    ["Started checkout", f.started],
    ["Sent payment receipt", f.submitted],
    ["Confirmed", f.confirmed],
  ] as const;
  return (
    <>
      <div className="funnel">
        {steps.map(([label, v], i) => (
          <div key={label} className="funnel-step">
            <div className="funnel-top">
              <span>{label}</span>
              <b>
                {v} <small>{pct(v / f.started)}</small>
              </b>
            </div>
            <div className="bar-track">
              <div className={`bar-fill ${i === 2 ? "green" : i === 1 ? "gold" : "blue"}`} style={{ width: `${(v / f.started) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="lost">
        <span>
          <b>{f.expired}</b> holds expired unpaid
        </span>
        <span>
          <b>{f.declined}</b> declined
        </span>
        <span>
          <b>{f.cancelled}</b> cancelled
        </span>
        <span>
          <b>{f.open}</b> still open
        </span>
      </div>
    </>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requireAdminPage();
  await expireOverdueHolds().catch(() => {});
  const sp = await searchParams;
  const { range, from, to } = resolveRange(sp, await earliestPlayDate());
  const [cfg, a] = await Promise.all([getConfig(), getAnalytics(range, from, to)]);
  const sym = cfg.currencySymbol || "₱";
  const money = (v: number) => `${sym}${Math.round(v).toLocaleString("en-PH")}`;
  const k: Kpis = a.kpis;
  const p: Kpis = a.prev;
  const s = a.snapshot;
  const live = k.bookings;

  return (
    <div className="analytics">
      <div className="an-head">
        <div>
          <h1>Analytics</h1>
          <p className="muted">
            {longDate(a.from)} – {longDate(a.to)} · {a.days} days · compared with the {a.days} days before
          </p>
        </div>
        <div className="an-filters">
          <div className="tabs" style={{ margin: 0 }}>
            {RANGES.map(([key, label]) => (
              <Link key={key} href={`/admin/analytics?range=${key}`} className={key === a.range ? "active" : ""}>
                {label}
              </Link>
            ))}
          </div>
          <form className="an-custom">
            <input type="date" name="from" defaultValue={a.from} aria-label="From" />
            <span>to</span>
            <input type="date" name="to" defaultValue={a.to} aria-label="To" />
            <button className={`btn btn-sm ${a.range === "custom" ? "btn-primary" : "btn-outline"}`}>Apply</button>
          </form>
        </div>
      </div>

      <div className="attn">
        <Link href="/admin/bookings?view=review" className={s.pendingCount ? "hot" : ""}>
          <span>Waiting for your review</span>
          <b>{s.pendingCount}</b>
          <small>{money(s.pendingValue)} in receipts</small>
        </Link>
        <Link href="/admin/bookings?view=upcoming">
          <span>Balances to collect</span>
          <b>{money(s.balanceValue)}</b>
          <small>{s.balanceCount} partly paid bookings</small>
        </Link>
        <Link href="/admin/bookings?view=abandoned">
          <span>Unpaid holds now</span>
          <b>{s.awaitingCount}</b>
          <small>checkouts awaiting payment</small>
        </Link>
        <Link href="/admin/grid">
          <span>Next 7 days</span>
          <b>{s.next7Hours} hrs</b>
          <small>
            {money(s.next7Revenue)} court fees · {pct(s.next7Capacity ? s.next7Hours / s.next7Capacity : 0)} full
          </small>
        </Link>
      </div>

      <div className="kpis">
        <Kpi label="Revenue" value={money(k.revenue)} hint="Total of confirmed and partly paid bookings, by play date">
          <Delta cur={k.revenue} prev={p.revenue} />
        </Kpi>
        <Kpi label="Collected" value={money(k.collected)} hint="Money actually received: full payments plus deposits">
          <span className="kpi-delta flat">{k.revenue ? pct(k.collected / k.revenue) : "—"} of revenue</span>
        </Kpi>
        <Kpi label="Bookings" value={String(k.bookings)}>
          <Delta cur={k.bookings} prev={p.bookings} />
        </Kpi>
        <Kpi label="Court hours" value={String(k.hours)}>
          <Delta cur={k.hours} prev={p.hours} />
        </Kpi>
        <Kpi label="Occupancy" value={pct(k.occupancy, 1)} hint={`${k.hours} of ${k.capacity} bookable court-hours`}>
          <Delta cur={k.occupancy} prev={p.occupancy} kind="pts" />
        </Kpi>
        <Kpi label="Avg. booking" value={money(k.avgBooking)}>
          <Delta cur={k.avgBooking} prev={p.avgBooking} />
        </Kpi>
        <Kpi label="Revenue / court-hour" value={money(k.capacity ? k.revenue / k.capacity : 0)} hint="Revenue divided by all bookable court-hours (RevPACH)">
          <Delta cur={k.capacity ? k.revenue / k.capacity : 0} prev={p.capacity ? p.revenue / p.capacity : 0} />
        </Kpi>
        <Kpi label="Customers" value={String(k.customers)}>
          <Delta cur={k.customers} prev={p.customers} />
        </Kpi>
      </div>

      <div className="panels">
        <Panel title={`Revenue per ${a.granularity}`} sub="Confirmed and partly paid bookings, by play date. Hover for details." wide>
          {k.revenue ? <TrendChart points={a.trend} sym={sym} unit={a.granularity} /> : <p className="empty">No revenue in this period yet.</p>}
        </Panel>

        <Panel title="When courts are busy" sub="Share of court-hours booked, by weekday and start time." wide>
          <Heatmap hours={a.heatmap.hours} cells={a.heatmap.cells} />
        </Panel>

        <Panel title="Where the money comes from">
          <MixBar
            money={money}
            parts={[
              { label: "Court fees", value: a.mix.court, tone: "green" },
              { label: "Equipment", value: a.mix.equipment, tone: "gold" },
              { label: "Booking fees", value: a.mix.fees, tone: "blue" },
            ]}
          />
          {live > 0 && (
            <p className="panel-foot">
              {a.payments.partial} of {live} bookings ({pct(a.payments.partial / live)}) paid a deposit instead of the full amount.
            </p>
          )}
        </Panel>

        <Panel title="Booking funnel" sub="Checkouts started in this period and how they ended.">
          <Funnel f={a.funnel} />
          <p className="panel-foot">
            Receipt reviewed in <b>{minutes(a.response.medianMin)}</b> (median), 9 in 10 within <b>{minutes(a.response.p90Min)}</b>.
          </p>
        </Panel>

        <Panel title="Revenue by court">
          <Bars rows={a.byCourt.map((c) => ({ ...c, sub: `${c.hours} hrs · ${pct(c.occupancy)} full` }))} fmt={money} />
        </Panel>

        <Panel title="Revenue by rate">
          <Bars rows={a.byBand.map((b) => ({ ...b, sub: `${money(b.price)}/hr · ${b.hours} hrs · ${pct(b.occupancy)} full` }))} fmt={money} tone="gold" />
        </Panel>

        <Panel title="Revenue by day of week">
          <Bars rows={a.byWeekday} fmt={money} />
        </Panel>

        <Panel title="Customers">
          <div className="mini-stats">
            <div>
              <b>{a.customers.unique}</b>
              <span>played</span>
            </div>
            <div>
              <b>{a.customers.fresh}</b>
              <span>first-timers</span>
            </div>
            <div>
              <b>{a.customers.returning}</b>
              <span>came back</span>
            </div>
            <div>
              <b>{a.customers.repeatInRange}</b>
              <span>booked 2+ times</span>
            </div>
          </div>
          {a.customers.unique > 0 && (
            <MixBar
              money={(v) => String(v)}
              parts={[
                { label: "First-timers", value: a.customers.fresh, tone: "gold" },
                { label: "Returning", value: a.customers.returning, tone: "green" },
              ]}
            />
          )}
        </Panel>

        <Panel title="How far ahead people book" sub="Days between booking and playing.">
          <Columns rows={a.leadTime} total={live} />
        </Panel>

        <Panel title="Session length" sub="Hours per booking.">
          <Columns rows={a.duration} total={live} />
        </Panel>

        <Panel title="Equipment rentals" sub={live ? `${pct(a.equipmentAttach)} of bookings added equipment.` : undefined}>
          {a.equipment.length ? (
            <Bars rows={a.equipment.map((e) => ({ label: e.name, value: e.revenue, sub: `${e.qty} rented · ${e.bookings} bookings` }))} fmt={money} tone="gold" />
          ) : (
            <p className="empty">No equipment rented in this period.</p>
          )}
        </Panel>

        <Panel title="Top customers" sub="By spend in this period.">
          {a.topCustomers.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th className="num">Bookings</th>
                    <th className="num">Hours</th>
                    <th className="num">Spend</th>
                    <th>Last played</th>
                  </tr>
                </thead>
                <tbody>
                  {a.topCustomers.map((c) => (
                    <tr key={c.phone}>
                      <td>
                        <Link href={`/admin/bookings?view=all&q=${encodeURIComponent(c.phone)}`}>{c.name}</Link>
                      </td>
                      <td className="mono">{c.phone}</td>
                      <td className="num">{c.bookings}</td>
                      <td className="num">{c.hours}</td>
                      <td className="num">{money(c.spend)}</td>
                      <td className="muted">{c.last}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">No customers in this period yet.</p>
          )}
        </Panel>
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        Revenue counts confirmed and partly paid bookings on the day they play. Occupancy is booked court-hours out of all bookable hours set by the rate
        bands, minus closed and open-play slots. <a href="/api/admin/export">Download bookings CSV</a>
      </p>
    </div>
  );
}
