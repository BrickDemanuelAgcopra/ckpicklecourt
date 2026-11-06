#!/usr/bin/env bash
# Turns on Telegram alerts to the owner for new bookings, and the homepage chat (guests' messages arrive
# in the same chats; reply to one in Telegram to answer on the website). Run on the server in a real terminal:
#   ssh -t ckpicklecourt 'bash /opt/ckpicklecourt/scripts/setup-telegram.sh'
# Before running: in Telegram, message @BotFather, send /newbot, and copy the token it gives you.
# Safe to re-run (e.g. to add another phone or switch to a group chat).
set -euo pipefail
cd /opt/ckpicklecourt

read -rsp "Telegram bot token from @BotFather (input hidden): " TOKEN; echo
TOKEN=${TOKEN// /}

ME=$(curl -fsS "https://api.telegram.org/bot$TOKEN/getMe" 2>/dev/null || true)
BOT=$(printf '%s' "$ME" | python3 -c 'import sys,json
try: print(json.load(sys.stdin)["result"]["username"])
except Exception: pass')
if [ -z "$BOT" ]; then echo "✗ That token didn't work. Copy it again from @BotFather and re-run."; exit 1; fi
echo "✓ Bot found: @$BOT"
# The site points the bot's webhook at itself for website-chat replies, which blocks getUpdates below.
# Clear it here; the app sets it again within a minute of the restart at the end.
curl -fsS -o /dev/null "https://api.telegram.org/bot$TOKEN/deleteWebhook" || true
echo
echo "Now, on each phone that should get alerts, open https://t.me/$BOT and tap START."
echo "(For a group instead: add @$BOT to the group and send any message there.)"
read -rp "Press Enter once that's done… " _

CHATS=$(curl -fsS "https://api.telegram.org/bot$TOKEN/getUpdates" | python3 -c '
import sys, json
seen = {}
for u in json.load(sys.stdin).get("result", []):
    m = u.get("message") or u.get("my_chat_member") or u.get("channel_post") or {}
    c = m.get("chat")
    if not c: continue
    name = c.get("title") or " ".join(filter(None, [c.get("first_name"), c.get("last_name")])) or c.get("username") or ""
    seen[str(c["id"])] = name
for cid, name in seen.items(): print(f"{cid}\t{name}")
')
if [ -z "$CHATS" ]; then echo "✗ No chats found. Make sure you tapped START (or messaged the group), then re-run."; exit 1; fi

echo "Chats that messaged the bot:"
printf '%s\n' "$CHATS" | awk -F'\t' '{printf "  %s  (%s)\n", $1, $2}'
ALL=$(printf '%s\n' "$CHATS" | cut -f1 | paste -sd, -)
read -rp "Chat IDs to alert, comma-separated [$ALL]: " IDS
IDS=${IDS:-$ALL}
IDS=${IDS// /}

setenv() { # replace KEY=... in .env, or append it
  if grep -q "^$1=" .env; then
    python3 - "$1" "$2" <<'PY'
import sys
k, v = sys.argv[1], sys.argv[2]
lines = open(".env").read().splitlines()
open(".env", "w").write("\n".join(f"{k}={v}" if l.startswith(k + "=") else l for l in lines) + "\n")
PY
  else
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
}
setenv TELEGRAM_BOT_TOKEN "$TOKEN"
setenv TELEGRAM_CHAT_ID "$IDS"
chmod 600 .env

echo "→ restarting app with the new settings"
docker compose up -d app >/dev/null

echo "→ sending a test alert"
OK=1
for C in ${IDS//,/ }; do
  if curl -fsS -o /dev/null "https://api.telegram.org/bot$TOKEN/sendMessage" \
      --data-urlencode "chat_id=$C" \
      --data-urlencode "text=🎾 CK Pickle Court: Telegram alerts are on. You'll get a message here for every new booking." ; then
    echo "  ✓ sent to $C"
  else
    echo "  ✗ could not send to $C"; OK=0
  fi
done
[ "$OK" = 1 ] && echo "✓ Done. Check Telegram." || exit 1
