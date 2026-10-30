"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { hourLabel } from "@/lib/time";
import type { Equipment } from "@/lib/types";

type Usage = { equipment_id: number; hour: number; qty: number };

export default function EquipmentAdmin({ items, date, hours, usage, rented }: { items: Equipment[]; date: string; hours: number[]; usage: Usage[]; rented: Usage[] }) {
  const router = useRouter();
  const [form, setForm] = useState<{ id?: number; name: string; unit: string; price: number; inventoryTotal: number; active: boolean }>({ name: "", unit: "", price: 0, inventoryTotal: 0, active: true });
  const [walk, setWalk] = useState<Record<string, number>>(Object.fromEntries(usage.map((u) => [`${u.equipment_id}:${u.hour}`, u.qty])));
  const [msg, setMsg] = useState<string | null>(null);

  const post = async (body: unknown) => {
    const r = await fetch("/api/admin/equipment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) setMsg((await r.json()).error || "Failed");
    else {
      setMsg("Saved");
      router.refresh();
    }
  };

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {msg && <div className="note">{msg}</div>}
      <div className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Rental items</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Unit</th>
              <th>Price / session</th>
              <th>Inventory</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td>{e.unit}</td>
                <td>{e.price}</td>
                <td>{e.inventory_total}</td>
                <td>{e.active ? "yes" : "no"}</td>
                <td>
                  <button className="btn btn-outline btn-sm" onClick={() => setForm({ id: e.id, name: e.name, unit: e.unit, price: e.price, inventoryTotal: e.inventory_total, active: e.active })}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto auto", gap: 8, marginTop: 12, alignItems: "end" }}
          onSubmit={(ev) => {
            ev.preventDefault();
            post({ op: "save_item", ...form });
            setForm({ name: "", unit: "", price: 0, inventoryTotal: 0, active: true });
          }}
        >
          <div className="field" style={{ margin: 0 }}>
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Paddle" required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Unit</label>
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="paddle" required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Price</label>
            <input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Inventory</label>
            <input type="number" min={0} value={form.inventoryTotal} onChange={(e) => setForm({ ...form, inventoryTotal: Number(e.target.value) })} />
          </div>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> active
          </label>
          <button className="btn btn-primary btn-sm">{form.id ? "Update" : "Add"}</button>
        </form>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 16 }}>Walk-in rentals · {date}</h2>
          <input type="date" value={date} onChange={(e) => e.target.value && router.push(`/admin/equipment?date=${e.target.value}`)} style={{ border: "1px solid var(--ck-line)", borderRadius: 8, padding: "6px 8px" }} />
        </div>
        <p className="muted">Log paddles handed out at the counter so online availability stays accurate. “Online” = units already in bookings for that hour.</p>
        {items.filter((i) => i.active).map((e) => (
          <div key={e.id} style={{ marginTop: 10 }}>
            <b>{e.name}</b> <span className="muted">(inventory {e.inventory_total})</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6, marginTop: 6 }}>
              {hours.map((h) => {
                const key = `${e.id}:${h}`;
                const online = rented.find((r) => r.equipment_id === e.id && r.hour === h)?.qty ?? 0;
                return (
                  <div key={h} style={{ border: "1px solid var(--ck-line-2)", borderRadius: 8, padding: 6, fontSize: 12 }}>
                    <div>{hourLabel(h)}</div>
                    <div className="muted">online {online}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                      <input type="number" min={0} max={e.inventory_total} value={walk[key] ?? 0} onChange={(ev) => setWalk({ ...walk, [key]: Number(ev.target.value) })} style={{ width: 56, border: "1px solid var(--ck-line)", borderRadius: 6, padding: 3 }} aria-label="Walk-in rentals" />
                      <button className="btn btn-outline btn-sm" style={{ padding: "2px 8px" }} onClick={() => post({ op: "walkin", date, equipmentId: e.id, hour: h, qty: walk[key] ?? 0 })}>
                        Save
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
