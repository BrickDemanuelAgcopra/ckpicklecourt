import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { handleTelegramUpdate } from "@/lib/chat";
import { telegramEnabled, webhookSecret } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/** Telegram calls this for messages sent to the bot (registered automatically by ensureTelegramWebhook). */
export async function POST(req: Request) {
  if (!telegramEnabled()) return NextResponse.json({ ok: false }, { status: 404 });
  const got = Buffer.from(req.headers.get("x-telegram-bot-api-secret-token") || "");
  const want = Buffer.from(webhookSecret());
  if (got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ ok: false }, { status: 401 });

  const update = await req.json().catch(() => null);
  // Always answer 200 so Telegram doesn't retry the same update forever on a bad message.
  if (update) await handleTelegramUpdate(update).catch((e) => console.error("telegram webhook failed", e));
  return NextResponse.json({ ok: true });
}
