#!/usr/bin/env bash
# Turns on booking emails. Run on the server:
#   ssh -t ckpicklecourt 'bash /opt/ckpicklecourt/scripts/setup-email.sh'
# Providers:
#   Brevo - verify ckpicklecourt.com under Senders & Domains, then SMTP & API → SMTP → generate an SMTP key.
#           The SMTP login looks like xxxxxx@smtp-brevo.com (not your account email).
#   Gmail - needs an App Password (Google Account → Security → 2-Step Verification → App passwords).
#   Other - any SMTP server (host, port, username, password).
# Safe to re-run; it overwrites the previous SMTP settings.
set -euo pipefail
cd /opt/ckpicklecourt

echo "Which email provider?"
echo "  1) Brevo"
echo "  2) Gmail"
echo "  3) Other SMTP server"
read -rp "Choose [1]: " CHOICE
CHOICE=${CHOICE:-1}

case "$CHOICE" in
  1)
    HOST=smtp-relay.brevo.com; PORT=587
    read -rp "Brevo SMTP login (looks like xxxxxx@smtp-brevo.com): " LOGIN
    read -rsp "Brevo SMTP key (input hidden): " PASS; echo
    read -rp "Send from address [no-reply@ckpicklecourt.com]: " FROM_ADDR
    FROM_ADDR=${FROM_ADDR:-no-reply@ckpicklecourt.com}
    DEFAULT_NOTIFY=""
    ;;
  2)
    HOST=smtp.gmail.com; PORT=465
    read -rp "Gmail address that sends the emails: " LOGIN
    read -rsp "Gmail App Password (16 letters, input hidden): " PASS; echo
    PASS=${PASS// /}
    FROM_ADDR=$LOGIN   # Gmail always sends as the signed-in account
    DEFAULT_NOTIFY=$LOGIN
    ;;
  3)
    read -rp "SMTP host: " HOST
    read -rp "SMTP port [587]: " PORT; PORT=${PORT:-587}
    read -rp "SMTP username: " LOGIN
    read -rsp "SMTP password (input hidden): " PASS; echo
    read -rp "Send from address: " FROM_ADDR
    DEFAULT_NOTIFY=""
    ;;
  *) echo "Unknown choice: $CHOICE"; exit 1 ;;
esac

# Port 465 is SSL from the start; 587/25/2525 upgrade to TLS via STARTTLS.
if [ "$PORT" = "465" ]; then SECURE=true; else SECURE=false; fi

NOTIFY=""
while [ -z "$NOTIFY" ]; do
  if [ -n "$DEFAULT_NOTIFY" ]; then
    read -rp "Where should new-booking alerts go? [$DEFAULT_NOTIFY]: " NOTIFY
    NOTIFY=${NOTIFY:-$DEFAULT_NOTIFY}
  else
    read -rp "Where should new-booking alerts go? (your email): " NOTIFY
  fi
done

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
setenv SMTP_HOST "$HOST"
setenv SMTP_PORT "$PORT"
setenv SMTP_SECURE "$SECURE"
setenv SMTP_USER "$LOGIN"
setenv SMTP_PASS "$PASS"
setenv SMTP_FROM "Chateau Katriannah <$FROM_ADDR>"
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
  .then(() => console.log("✓ test email sent from " + process.env.SMTP_FROM + " — check the inbox (and spam)"))
  .catch((e) => {
    console.error("✗ sending failed:", e.message);
    if (/sender|not.*(valid|verified|authori)/i.test(e.message)) console.error("  Hint: the From address/domain may not be verified with your provider yet.");
    if (/auth|535|credentials/i.test(e.message)) console.error("  Hint: check the SMTP login and key/password.");
    process.exit(1);
  });
'
