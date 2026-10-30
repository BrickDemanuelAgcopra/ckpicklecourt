#!/usr/bin/env bash
# One-shot VPS bootstrap / redeploy. Run as root (or with sudo) on the server:
#   curl -fsSL https://raw.githubusercontent.com/BrickDemanuelAgcopra/ckpicklecourt/main/scripts/deploy-vps.sh | sudo bash
# Re-running pulls the latest code and rebuilds; an existing .env is never overwritten.
set -euo pipefail

REPO=https://github.com/BrickDemanuelAgcopra/ckpicklecourt.git
DIR=/opt/ckpicklecourt
DOMAIN=${DOMAIN:-ckpicklecourt.com}

if ! command -v docker >/dev/null 2>&1; then
  echo "→ installing Docker"
  curl -fsSL https://get.docker.com | sh
fi
command -v git >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq git; }

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  echo "→ opening ports 80/443 in ufw"
  ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 443/udp >/dev/null
fi

if [ -d "$DIR/.git" ]; then
  echo "→ updating code"
  git -C "$DIR" pull --ff-only
else
  echo "→ cloning code"
  git clone "$REPO" "$DIR"
fi
cd "$DIR"

if [ ! -f .env ]; then
  echo "→ generating .env"
  rnd() { openssl rand -hex "$1"; }
  ADMIN_PASSWORD=$(rnd 8)
  cp .env.example .env
  sed -i \
    -e "s|^SITE_URL=.*|SITE_URL=https://$DOMAIN|" \
    -e "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=https://$DOMAIN|" \
    -e "s|^SITE_DOMAIN=.*|SITE_DOMAIN=$DOMAIN|" \
    -e "s|^ACME_EMAIL=.*|ACME_EMAIL=${ACME_EMAIL:-admin@$DOMAIN}|" \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(rnd 24)|" \
    -e "s|^SESSION_SECRET=.*|SESSION_SECRET=$(rnd 32)|" \
    -e "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${ADMIN_EMAIL:-admin@$DOMAIN}|" \
    -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$ADMIN_PASSWORD|" \
    -e "s|^CRON_SECRET=.*|CRON_SECRET=$(rnd 24)|" \
    .env
  chmod 600 .env
  echo
  echo "  Admin login: $(grep ^ADMIN_EMAIL= .env | cut -d= -f2)  /  $ADMIN_PASSWORD"
  echo "  (stored in $DIR/.env — change it after first login)"
  echo
fi

echo "→ building and starting containers"
docker compose up -d --build
docker compose ps
echo "→ done. Follow logs with: cd $DIR && docker compose logs -f app caddy"
