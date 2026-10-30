#!/bin/sh
set -e
echo "→ waiting for PostgreSQL…"
i=0
until node -e "const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.end()).then(()=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null; do
  i=$((i+1)); [ $i -gt 60 ] && echo "database not reachable" && exit 1
  sleep 2
done
echo "→ running migrations"
node scripts/migrate.mjs
echo "→ seeding (idempotent)"
node scripts/seed.mjs
echo "→ starting Next.js on :$PORT"
exec node server.js
