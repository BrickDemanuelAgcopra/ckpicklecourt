"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import type { Faq } from "@/lib/types";

type Msg = { id: number | string; sender: "guest" | "staff" | "bot"; body: string; note?: string };

const KEY = "ck-chat"; // { threadId, seen, name }
const load = (): { threadId?: string; seen?: number; name?: string } => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
};
const save = (v: { threadId?: string; seen?: number; name?: string }) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...load(), ...v }));
  } catch {}
};

/** Floating "Chat with us" bubble: instant answers from the FAQ, plus live messages to the team over Telegram. */
export default function ChatWidget({
  enabled,
  courtName,
  logoUrl,
  faqs,
  contactNumber,
  facebookPage,
}: {
  enabled: boolean;
  courtName: string;
  logoUrl: string;
  faqs: Faq[];
  contactNumber?: string;
  facebookPage?: string;
}) {
  const [open, setOpen] = useState(false);
  // stored state is only rendered once the panel is opened, so reading it at init can't cause a hydration mismatch
  const [threadId, setThreadId] = useState<string>(() => (typeof window === "undefined" ? "" : load().threadId ?? ""));
  const [seen, setSeen] = useState<number>(() => (typeof window === "undefined" ? 0 : load().seen ?? 0));
  const [name, setName] = useState(() => (typeof window === "undefined" ? "" : load().name ?? ""));
  const [server, setServer] = useState<Msg[]>([]); // persisted conversation with staff
  const [local, setLocal] = useState<Msg[]>([]); // FAQ instant answers, this visit only
  const [contact, setContact] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState<{ after: number; text: string } | null>(null); // shown under that message
  const lastId = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const markSeen = useCallback(() => {
    if (!lastId.current) return;
    setSeen(lastId.current);
    save({ seen: lastId.current });
  }, []);

  const poll = useCallback(async () => {
    if (!threadId) return;
    try {
      const r = await fetch(`/api/chat/${threadId}?after=${lastId.current}`, { cache: "no-store" });
      if (r.status === 404) {
        save({ threadId: undefined, seen: 0 });
        setThreadId("");
        setServer([]);
        lastId.current = 0;
        return;
      }
      if (!r.ok) return;
      const { messages } = (await r.json()) as { messages: { id: number; sender: "guest" | "staff"; body: string }[] };
      if (!messages.length) return;
      lastId.current = messages[messages.length - 1].id;
      setServer((prev) => {
        const have = new Set(prev.map((m) => m.id));
        return [...prev, ...messages.filter((m) => !have.has(m.id))];
      });
      if (openRef.current) markSeen();
    } catch {}
  }, [threadId, markSeen]);

  // poll: quickly while the panel is open and the tab visible, slowly otherwise
  useEffect(() => {
    if (!threadId) return;
    const first = setTimeout(poll, 0);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, open ? 4000 : 30000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [threadId, open, poll]);

  const unread = open ? 0 : server.filter((m) => m.sender === "staff" && Number(m.id) > seen).length;

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [server, local, open, notice]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  function toggle() {
    if (!open) markSeen();
    setOpen(!open);
  }

  function ask(f: Faq) {
    setLocal((l) => [...l, { id: `q${l.length}`, sender: "guest", body: f.q }, { id: `a${l.length}`, sender: "bot", body: f.a, note: "Instant answer" }]);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    if (!threadId && !name.trim()) return setErr("Please enter your name first.");
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: threadId || undefined, name, contact, text: body }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't send. Please try again.");
      setText("");
      if (!threadId) {
        save({ threadId: j.threadId, name });
        setThreadId(j.threadId);
        setNotice({ after: j.message.id, text: "Thanks! Your message went straight to our team. Their reply will show up right here — you can close this and come back later on this device." });
      }
      setServer((prev) => (prev.some((m) => m.id === j.message.id) ? prev : [...prev, j.message]));
      lastId.current = Math.max(lastId.current, j.message.id);
      markSeen();
      if (!j.delivered) setErr("Saved, but we couldn't alert the team just now. If it's urgent, please call us.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send.");
    } finally {
      setBusy(false);
    }
  }

  // FAQ answers first, then the live conversation
  const msgs: Msg[] = [...local, ...server];
  const chips = faqs.filter((f) => !local.some((m) => m.body === f.q));

  return (
    <>
      {open && (
        <div className="chat-panel" role="dialog" aria-label={`Chat with ${courtName}`}>
          <div className="chat-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoUrl && <img src={logoUrl} alt="" />}
            <div>
              <b>{courtName}</b>
              <small>{enabled ? "Ask us anything — our team replies here" : "Quick answers"}</small>
            </div>
            <button className="chat-x" aria-label="Close chat" onClick={() => setOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="chat-body" ref={bodyRef}>
            <div className="chat-msg bot">
              <span>Hi there! 👋 Tap a question below for an instant answer{enabled ? ", or type a message and our team will reply right here." : "."}</span>
            </div>
            {msgs.map((m) => (
              <div key={m.id} className={`chat-msg ${m.sender}`}>
                {m.sender === "staff" && <small>{courtName} team</small>}
                {m.note && <small>{m.note}</small>}
                <span>{m.body}</span>
              </div>
            )).flatMap((el, i) => (notice && msgs[i].id === notice.after ? [el, <div key="notice" className="chat-note">{notice.text}</div>] : [el]))}
            {chips.length > 0 && (
              <div className="chat-chips">
                {chips.map((f) => (
                  <button key={f.q} type="button" onClick={() => ask(f)}>
                    {f.q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {enabled ? (
            <form className="chat-form" onSubmit={send}>
              {!threadId && (
                <div className="chat-who">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name *" maxLength={60} autoComplete="name" aria-label="Your name" />
                  <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Mobile no. (optional)" maxLength={80} autoComplete="tel" inputMode="tel" aria-label="Mobile number (optional)" />
                </div>
              )}
              {err && <div className="chat-err">{err}</div>}
              <div className="chat-compose">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="Type your message…"
                  rows={1}
                  maxLength={1000}
                  aria-label="Message"
                />
                <button type="submit" disabled={busy || !text.trim()} aria-label="Send">
                  <Send size={18} />
                </button>
              </div>
            </form>
          ) : (
            <div className="chat-offline">
              Live chat is offline right now.
              {contactNumber && (
                <>
                  {" "}Call or text <a href={`tel:${contactNumber.replace(/[^\d+]/g, "")}`}>{contactNumber}</a>
                </>
              )}
              {facebookPage && (
                <>
                  {contactNumber ? " or " : " "}
                  <a href={facebookPage} target="_blank" rel="noreferrer">message us on Facebook</a>
                </>
              )}
              .
            </div>
          )}
        </div>
      )}

      <button className={`chat-fab${open ? " is-open" : ""}`} onClick={toggle} aria-label={open ? "Close chat" : "Chat with us"}>
        {open ? <X size={24} /> : <MessageCircle size={24} />}
        {!open && <span className="chat-fab-label">Chat with us</span>}
        {unread > 0 && !open && <span className="chat-badge">{unread}</span>}
      </button>
    </>
  );
}
