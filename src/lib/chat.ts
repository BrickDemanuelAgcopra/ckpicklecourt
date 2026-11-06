// Website chat. Guest messages are stored and forwarded to the owner's Telegram chat(s); a staff member
// swipe-replies to one of those Telegram messages and the answer appears in the guest's chat window.
import { query } from "./db";
import { api, chatIds, ensureTelegramWebhook, h } from "./telegram";

export type ChatMessage = { id: number; sender: "guest" | "staff"; body: string; created_at: string };

export const LIMITS = { name: 60, contact: 80, body: 1000 };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isThreadId = (s: string) => UUID.test(s);

export async function threadExists(id: string): Promise<{ guest_name: string; contact: string | null } | null> {
  if (!isThreadId(id)) return null;
  const rows = await query<{ guest_name: string; contact: string | null }>("SELECT guest_name, contact FROM chat_threads WHERE id=$1", [id]);
  return rows[0] ?? null;
}

export async function createThread(name: string, contact: string | null): Promise<string> {
  const rows = await query<{ id: string }>("INSERT INTO chat_threads(guest_name, contact) VALUES($1,$2) RETURNING id", [name, contact]);
  return rows[0].id;
}

export async function getMessages(threadId: string, after = 0): Promise<ChatMessage[]> {
  return query<ChatMessage>(
    "SELECT id::int AS id, sender, body, created_at FROM chat_messages WHERE thread_id=$1 AND id>$2 ORDER BY id LIMIT 200",
    [threadId, after],
  );
}

async function addMessage(threadId: string, sender: "guest" | "staff", body: string): Promise<ChatMessage> {
  const rows = await query<ChatMessage>(
    "INSERT INTO chat_messages(thread_id, sender, body) VALUES($1,$2,$3) RETURNING id::int AS id, sender, body, created_at",
    [threadId, sender, body],
  );
  await query("UPDATE chat_threads SET last_at=now() WHERE id=$1", [threadId]);
  return rows[0];
}

/** Stores the guest's message and forwards it to every owner chat. Returns false if Telegram delivery failed everywhere. */
export async function postGuestMessage(threadId: string, body: string, isFirst: boolean): Promise<{ msg: ChatMessage; delivered: boolean }> {
  const msg = await addMessage(threadId, "guest", body);
  const t = (await threadExists(threadId))!;
  await ensureTelegramWebhook();

  const short = threadId.slice(0, 6);
  const text = isFirst
    ? [
        `💬 <b>New website chat</b> · #${short}`,
        `👤 <b>${h(t.guest_name)}</b>${t.contact ? `\n📞 ${h(t.contact)}` : ""}`,
        ``,
        h(body),
        ``,
        `<i>↩️ Reply to this message to answer them on the website.</i>`,
      ].join("\n")
    : `💬 <b>${h(t.guest_name)}</b> · #${short}\n${h(body)}`;

  let delivered = false;
  for (const chat of chatIds()) {
    try {
      const sent = await api<{ message_id: number }>("sendMessage", { chat_id: chat, text, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
      await query("INSERT INTO chat_tg_messages(chat_id, message_id, thread_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [chat, sent.message_id, threadId]);
      delivered = true;
    } catch (e) {
      console.error("chat → telegram failed", e);
    }
  }
  return { msg, delivered };
}

type TgMessage = {
  message_id: number;
  chat: { id: number };
  from?: { first_name?: string };
  text?: string;
  caption?: string;
  reply_to_message?: { message_id: number };
};

/** Handles a Telegram update: a staff reply to a forwarded chat message goes back to that guest. */
export async function handleTelegramUpdate(update: { message?: TgMessage }): Promise<void> {
  const m = update.message;
  if (!m) return;
  const chat = String(m.chat.id);
  if (!chatIds().includes(chat)) return; // only the owner's own chats may answer guests
  const text = (m.text ?? m.caption ?? "").trim();
  if (!text || text.startsWith("/")) return;

  if (!m.reply_to_message) {
    await api("sendMessage", {
      chat_id: chat,
      text: "To answer a website chat, swipe left on (or long-press → Reply) the customer's message, then type your answer.",
      reply_parameters: { message_id: m.message_id },
    }).catch(() => {});
    return;
  }

  const rows = await query<{ thread_id: string }>("SELECT thread_id FROM chat_tg_messages WHERE chat_id=$1 AND message_id=$2", [chat, m.reply_to_message.message_id]);
  const threadId = rows[0]?.thread_id;
  if (!threadId) {
    await api("sendMessage", { chat_id: chat, text: "That message isn't a website chat, so the reply wasn't sent anywhere.", reply_parameters: { message_id: m.message_id } }).catch(() => {});
    return;
  }

  await addMessage(threadId, "staff", text.slice(0, 4000));
  // Map the staff reply too, so replying to it later also reaches the same guest.
  await query("INSERT INTO chat_tg_messages(chat_id, message_id, thread_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [chat, m.message_id, threadId]);
  await api("setMessageReaction", { chat_id: chat, message_id: m.message_id, reaction: [{ type: "emoji", emoji: "👍" }] }).catch(() => {});
}
