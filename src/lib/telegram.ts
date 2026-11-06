// Owner alerts over Telegram. Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (comma-separated for
// several people or a group) in .env — scripts/setup-telegram.sh does it. Independent of the email switch.
import { createHash } from "node:crypto";
import { extname } from "node:path";
import { getConfig } from "./config";
import { money } from "./format";
import { readUpload } from "./storage";
import { scheduleBlocks, siteUrl } from "./email";
import type { BookingDetail } from "./types";

export function chatIds(): string[] {
  return (process.env.TELEGRAM_CHAT_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function telegramEnabled(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN) && chatIds().length > 0;
}

export const h = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Calls the Bot API and returns its `result`. */
export async function api<T = unknown>(method: string, body: FormData | Record<string, unknown>): Promise<T> {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
  const res =
    body instanceof FormData
      ? await fetch(url, { method: "POST", body, signal: AbortSignal.timeout(20_000) })
      : await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`telegram ${method} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { result: T }).result;
}

/** Secret Telegram echoes in X-Telegram-Bot-Api-Secret-Token on webhook calls. Derived from the token, so no extra setting. */
export function webhookSecret(): string {
  return createHash("sha256").update(`ck-webhook:${process.env.TELEGRAM_BOT_TOKEN || ""}`).digest("hex").slice(0, 48);
}

let webhookReady = false;
/** Points the bot's webhook at this site (once per process) so staff replies reach the website chat. Never throws. */
export async function ensureTelegramWebhook(): Promise<void> {
  if (webhookReady || !telegramEnabled()) return;
  const base = siteUrl();
  if (!base.startsWith("https://")) return; // Telegram only calls https; skip in local dev
  const url = `${base}/api/telegram/webhook`;
  try {
    const info = await api<{ url: string }>("getWebhookInfo", {});
    if (info.url !== url) {
      await api("setWebhook", { url, secret_token: webhookSecret(), allowed_updates: ["message"], drop_pending_updates: true });
      console.log("telegram webhook set to", url);
    }
    webhookReady = true;
  } catch (e) {
    console.error("telegram setWebhook failed", e);
  }
}

/** "New booking" alert to the owner: summary, buttons into Admin, and the receipt image. Never throws. */
export async function notifyTelegramNewBooking(b: BookingDetail): Promise<boolean> {
  if (!telegramEnabled()) return false;
  try {
    const cfg = await getConfig();
    const m = (n: number | string) => money(n, cfg.currencySymbol);
    const total = Number(b.total);
    const partial = b.partial_payment && b.partial_percent;
    const expected = partial ? Math.round((total * b.partial_percent!) / 100) : total;

    const lines = [
      `🎾 <b>New booking to review</b>`,
      `<code>${h(b.confirmation_id)}</code>`,
      ``,
      `👤 <b>${h(b.guest_name)}</b>`,
      b.guest_phone ? `📞 ${h(b.guest_phone)}` : "",
      b.guest_email ? `✉️ ${h(b.guest_email)}` : "",
      ``,
      ...scheduleBlocks(b).map((s) => `📅 <b>${h(s.court)}</b> · ${h(s.date)}\n      ${h(s.time)}`),
      ...(b.equipment.length ? ["", ...b.equipment.map((e) => `🏓 ${h(e.name)} × ${e.qty}`)] : []),
      ``,
      `💰 Total <b>${m(total)}</b>`,
      partial ? `💳 Paying ${b.partial_percent}% deposit: <b>${m(expected)}</b>` : `💳 Paying in full: <b>${m(expected)}</b>`,
      ``,
      `Check the receipt, then confirm or decline in Admin.`,
    ].filter((l, i, a) => l !== "" || (a[i - 1] !== "" && i > 0));

    const buttons = [[{ text: "✅ Review in Admin", url: `${siteUrl()}/admin/bookings?view=review&q=${encodeURIComponent(b.confirmation_id)}` }]];
    const f = b.receipt_path ? await readUpload(b.receipt_path).catch(() => null) : null;

    for (const chat of chatIds()) {
      await api("sendMessage", { chat_id: chat, text: lines.join("\n"), parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: buttons } });
      if (f) {
        const isImage = /^image\/(jpeg|png|webp)$/.test(f.type);
        const fd = new FormData();
        fd.append("chat_id", chat);
        fd.append("caption", `Receipt · ${b.confirmation_id} · ${b.guest_name}`);
        fd.append(isImage ? "photo" : "document", new Blob([new Uint8Array(f.buf)], { type: f.type }), `receipt-${b.confirmation_id}${extname(b.receipt_path!)}`);
        await api(isImage ? "sendPhoto" : "sendDocument", fd);
      }
    }
    return true;
  } catch (e) {
    console.error("telegram alert failed", e);
    return false;
  }
}
