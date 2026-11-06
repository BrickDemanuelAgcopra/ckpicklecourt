import { NextResponse } from "next/server";
import { LIMITS, createThread, isThreadId, postGuestMessage, threadExists } from "@/lib/chat";
import { rateLimit } from "@/lib/ratelimit";
import { telegramEnabled } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+\n/g, "\n").trim().slice(0, max) : "");

/** A guest sends a chat message. Without a threadId, starts a new conversation (name required). */
export async function POST(req: Request) {
  if (!telegramEnabled()) return NextResponse.json({ error: "Chat is offline right now." }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`chat:${ip}`, 12, 60_000)) return NextResponse.json({ error: "You're sending messages too fast. Please wait a moment." }, { status: 429 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = clean(b.text, LIMITS.body);
  if (!text) return NextResponse.json({ error: "Please type a message." }, { status: 400 });

  let threadId = typeof b.threadId === "string" && isThreadId(b.threadId) && (await threadExists(b.threadId)) ? b.threadId : "";
  const isFirst = !threadId;
  if (isFirst) {
    const name = clean(b.name, LIMITS.name);
    if (!name) return NextResponse.json({ error: "Please tell us your name.", code: "name" }, { status: 400 });
    if (!rateLimit(`chat-new:${ip}`, 5, 60 * 60_000)) return NextResponse.json({ error: "Too many new chats. Please try again later." }, { status: 429 });
    threadId = await createThread(name, clean(b.contact, LIMITS.contact) || null);
  }

  const { msg, delivered } = await postGuestMessage(threadId, text, isFirst);
  return NextResponse.json({ threadId, message: msg, delivered });
}
