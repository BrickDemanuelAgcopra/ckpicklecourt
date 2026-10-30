# Chateau Katriannah Pickleball Club — court booking site

Live-availability court booking for **ckpicklecourt.com**: guests pick open hours, pay by GCash QR, upload the receipt, and staff confirm from an admin dashboard. Feature-for-feature clone of the ABC Pickleball Courts booking system, rebuilt on **Next.js 16 + PostgreSQL** with the club's green-and-gold crest.

## What's inside

| Area | Features |
| --- | --- |
| Public page | Splash screen, sticky header + nav, hero card with photo gallery/lightbox, court rates, 14-day date strip + jump-to-date (60-day window), live availability grid (Open / Selected / Booked (initials) / Pending / Passed / Closed / Open Play / Promo), sticky summary panel, Court Information accordion, FAQ |
| Booking flow | Booking details modal (name, phone, optional email, processing fee), equipment rental step with live inventory, slot hold with countdown, QR payment page, receipt upload, confirmation reference, email notifications (optional SMTP) |
| Tracking | Track Booking modal + `/bookings` page (by confirmation ID or exact name), `/bookings/:id` status page |
| Admin (`/admin`) | Login (30-min idle timeout), bookings review (confirm / confirm partial / balance settled / decline / cancel / remove hour), abandoned-checkout cleanup, court grid close/reopen hours, equipment items + walk-in rental log, settings (club info, fees, payment QR, courts, rate bands, content, FAQ), audit log, CSV export |
| Ops | Docker Compose (app + Postgres + Caddy auto-HTTPS + expiry cron), SQL migrations, idempotent seed, rate limiting, receipts stored on a private volume |

## Quick start on the VPS (Docker)

Prereqs on the server: Docker Engine + Compose plugin (`curl -fsSL https://get.docker.com | sh`). Ports 80 and 443 open.

```bash
# 1. put the folder on the server
scp -r ckpicklecourt user@your-vps:/opt/ckpicklecourt
ssh user@your-vps && cd /opt/ckpicklecourt

# 2. configure
cp .env.example .env
nano .env     # set POSTGRES_PASSWORD, SESSION_SECRET (openssl rand -hex 32), ADMIN_EMAIL/ADMIN_PASSWORD, CRON_SECRET, ACME_EMAIL

# 3. build + run (migrations and seed run automatically on start)
docker compose up -d --build
docker compose logs -f app   # wait for "starting Next.js"
```

Then open `https://ckpicklecourt.com` and `https://ckpicklecourt.com/admin`.

### Cloudflare DNS (domain bought on Cloudflare)

1. Cloudflare → ckpicklecourt.com → **DNS**: add `A  @  <VPS IP>` and `A  www  <VPS IP>`.
2. Set both records to **DNS only (grey cloud)** at least until Caddy has issued the certificate (it uses Let's Encrypt HTTP-01 on port 80). You can leave them grey permanently — Caddy already serves HTTPS.
3. If you later turn the orange proxy on: Cloudflare → **SSL/TLS → Full (strict)**, and keep Caddy as is.
4. Receipts are up to 10 MB; Cloudflare's free plan allows 100 MB uploads, so no change needed.

### After first login

Admin → **Settings**:
- Upload the real **GCash QR** and type the bank/account details (the seed ships a placeholder QR).
- Check address, Google Maps link, contact details, FAQ and policies.
- Replace the generated court illustrations: drop real photos into `public/images/` (keep the names `hero.jpg`, `court-2.jpg` … or edit the gallery list in Settings), then `docker compose up -d --build`.

## Local development

```bash
npm install
createdb ckpickle                       # any Postgres 14+
cp .env.example .env                    # set DATABASE_URL=postgres://user:pass@localhost:5432/ckpickle, SESSION_SECRET, ADMIN_*
npm run db:setup                        # migrations + seed
npm run dev                             # http://localhost:3000
```

`npm run typecheck`, `npm run lint`, `npm run build` all pass.

## Project layout

```
db/migrations/        SQL migrations (applied in order by scripts/migrate.mjs)
scripts/              migrate.mjs, seed.mjs
docker/               Caddyfile, entrypoint.sh
public/brand/         logo, favicon, OG image, placeholder payment QR
public/images/        hero + gallery
src/app/              routes: / , /checkout/[id], /bookings, /bookings/[id], /browser, /privacy, /admin/*, /api/*
src/components/       public UI (BookingWidget, Hero, Checkout, TrackBooking…) and admin/*
src/lib/              db, config, availability (grid engine), bookings (holds/expiry), auth, email, storage, audit
```

## How the booking engine works

- Hours are generated from **rate bands** (e.g. 6–9 AM ₱400, 3 PM–12 MN ₱450); hours outside any band are not shown.
- `booking_slots` has `UNIQUE (court_id, date, hour)` — the double-booking lock. A hold is inserted in one transaction; a conflict returns 409 and the grid refreshes.
- A hold is `awaiting_payment` with `hold_expires_at = now + paymentWindowMinutes`. Overdue holds are flipped to `expired` and their slots deleted by `/api/cron/expire` (the `cron` container calls it every minute; pages also sweep on load).
- Receipt upload → `pending`. Admin confirm → `confirmed` (or `balance_due` for partial payment, then “Balance settled”). Decline/cancel release the slots.
- The public grid polls every 15 s so other guests' holds appear as **Pending**.

## Environment variables

See `.env.example`. Required: `DATABASE_URL` (composed automatically in Docker), `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Optional: SMTP for emails, `CRON_SECRET`, `SEED_*` for first-run club details.

## Backups

```bash
docker compose exec db pg_dump -U ckpickle ckpickle | gzip > backup-$(date +%F).sql.gz
docker run --rm -v ckpicklecourt_uploads:/data -v $PWD:/out alpine tar czf /out/uploads-$(date +%F).tgz -C /data .
```
