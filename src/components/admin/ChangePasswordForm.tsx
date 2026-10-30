"use client";
import { useState } from "react";

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="card"
      style={{ padding: 18, maxWidth: 420 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (next !== again) return setMsg({ ok: false, text: "The new passwords don't match." });
        setBusy(true);
        const r = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "change_own", current, next }) });
        const j = await r.json();
        setBusy(false);
        if (!r.ok) return setMsg({ ok: false, text: j.error || "Failed" });
        setCurrent("");
        setNext("");
        setAgain("");
        setMsg({ ok: true, text: "Password changed." });
      }}
    >
      <h2 style={{ fontSize: 16, marginBottom: 10 }}>Change password</h2>
      <div className="field">
        <label>Current password</label>
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="field">
        <label>New password (10+ characters)</label>
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={10} />
      </div>
      <div className="field">
        <label>New password again</label>
        <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required minLength={10} />
      </div>
      {msg && <div className={msg.ok ? "note" : "error"}>{msg.text}</div>}
      <button className="btn btn-primary btn-sm" disabled={busy}>
        {busy ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
