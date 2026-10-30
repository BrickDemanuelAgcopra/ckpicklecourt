#!/usr/bin/env bash
# Turns on booking emails using a Gmail account. Run on the server:
#   ssh -t ckpicklecourt 'bash /opt/ckpicklecourt/scripts/setup-email.sh'
# Needs a Gmail App Password (Google Account → Security → 2-Step Verification → App passwords).
set -euo pipefail
cd /opt/ckpicklecourt

read -rp "Gmail address that sends the emails: " GMAIL
read -rsp "Gmail App Password (16 letters, input hidden): " APP_PASS; echo
APP_PASS=${APP_PASS// /}
read -rp "Where should new-booking alerts go? [$GMAIL]: " NOTIFY
NOTIFY=${NOTIFY:-$GMAIL}

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
setenv SMTP_HOST smtp.gmail.com
setenv SMTP_PORT 465
setenv SMTP_SECURE true
setenv SMTP_USER "$GMAIL"
setenv SMTP_PASS "$APP_PASS"
setenv SMTP_FROM "Chateau Katriannah <$GMAIL>"
chmod 600 .env

echo "→ restarting app with the new mail settings"
docker compose up -d app >/dev/null
for i in $(seq 1 30); do docker compose exec -T app node -e "fetch('http://localhost:3000/api/availability').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null && break; sleep 2; done

echo "→ switching on emails and setting the alert address in Admin settings"
U=$(grep ^POSTGRES_USER= .env | cut -d= -f2); U=${U:-ckpickle}
D=$(grep ^POSTGRES_DB= .env | cut -d= -f2); D=${D:-ckpickle}
docker compose exec -T db psql -q -U "$U" -d "$D" -v notify="$NOTIFY" <<'SQL'
UPDATE settings SET value = jsonb_set(jsonb_set(value, '{emailSendingEnabled}', 'true'), '{adminEmail}', to_jsonb(:'notify'::text)), updated_at = now() WHERE key = 'config';
SQL

echo "→ sending a test email to $NOTIFY"
docker compose exec -T -e NOTIFY="$NOTIFY" app node -e '
const nodemailer = require("nodemailer");
const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: process.env.SMTP_SECURE === "true", auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
t.sendMail({ from: process.env.SMTP_FROM, to: process.env.NOTIFY, subject: "CK Pickle Court: email is working", text: "Booking emails are now switched on. You will get an email here whenever a guest uploads a payment receipt." })
  .then(() => console.log("✓ test email sent — check the inbox (and spam)"))
  .catch((e) => { console.error("✗ sending failed:", e.message); process.exit(1); });
'
