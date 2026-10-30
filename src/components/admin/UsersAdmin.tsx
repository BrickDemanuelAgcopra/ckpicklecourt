"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminUser } from "@/lib/users";

async function post(body: unknown): Promise<{ ok: boolean; password?: string; error?: string }> {
  const r = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  return { ok: r.ok, ...j };
}

export default function UsersAdmin({ users, me }: { users: AdminUser[]; me: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (body: unknown, forEmail?: string) => {
    setBusy(true);
    setErr(null);
    const r = await post(body);
    setBusy(false);
    if (!r.ok) return setErr(r.error || "Failed");
    if (r.password && forEmail) setIssued({ email: forEmail, password: r.password });
    router.refresh();
  };

  return (
    <>
      {issued && (
        <div className="note" style={{ fontSize: 14 }}>
          <b>Temporary password for {issued.email}:</b>{" "}
          <span className="mono" style={{ fontSize: 16, fontWeight: 700, userSelect: "all" }}>
            {issued.password}
          </span>
          <div className="muted" style={{ marginTop: 6 }}>
            Shown only once. Give it to them privately (a call or in person). They sign in at ckpicklecourt.com/admin and change it under <b>My account</b>.
          </div>
          <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => setIssued(null)}>
            Done, hide it
          </button>
        </div>
      )}
      {err && <div className="error">{err}</div>}

      <table className="table" style={{ marginBottom: 18 }}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Access</th>
            <th>Added</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <b>{u.email}</b>
                {u.email === me && <span className="muted"> (you)</span>}
              </td>
              <td>{u.role === "owner" ? "Owner: everything, incl. audit log and users" : "Admin: everything except audit log and users"}</td>
              <td className="muted">{new Date(u.created_at).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}</td>
              <td>
                {u.role !== "owner" && (
                  <div className="actions">
                    <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => confirm(`Give ${u.email} a new temporary password? Their current one stops working.`) && run({ op: "reset", id: u.id }, u.email)}>
                      Reset password
                    </button>
                    <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => confirm(`Remove ${u.email}? They are signed out right away.`) && run({ op: "remove", id: u.id })}>
                      Remove
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form
        className="card"
        style={{ padding: 18, maxWidth: 520 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const em = email.trim().toLowerCase();
          await run({ op: "add", email: em }, em);
          setEmail("");
        }}
      >
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Add an admin</h2>
        <div className="field">
          <label>Their email (used to sign in)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={160} />
        </div>
        <button className="btn btn-primary btn-sm" disabled={busy || !email}>
          Add and create temporary password
        </button>
      </form>
    </>
  );
}
