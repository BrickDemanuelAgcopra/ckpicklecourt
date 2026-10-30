import { requireOwnerPage } from "@/lib/admin";
import { query } from "@/lib/db";
import { AUDIT_LABELS, type AuditAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireOwnerPage();
  const rows = await query<{ id: number; actor: string; action_type: AuditAction; entity_type: string; entity_id: string | null; payload: unknown; created_at: string }>(
    "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 300"
  );
  return (
    <>
      <h1>Audit log</h1>
      <p className="muted" style={{ marginBottom: 10 }}>
        Last 300 events. <a href="/api/admin/export">Download bookings CSV</a>
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>Event</th>
            <th>Entity</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="muted" style={{ whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</td>
              <td>{r.actor}</td>
              <td>{AUDIT_LABELS[r.action_type] ?? r.action_type}</td>
              <td className="mono">
                {r.entity_type}
                {r.entity_id ? ` ${r.entity_id.slice(0, 18)}` : ""}
              </td>
              <td className="mono muted" style={{ maxWidth: 360, wordBreak: "break-all" }}>{r.payload ? JSON.stringify(r.payload).slice(0, 200) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
