// Seeds the club configuration, courts, rate bands, equipment and the first admin.
// Idempotent: safe to run again. Usage: node scripts/seed.mjs
import pg from "pg";
import bcrypt from "bcryptjs";
import { content, COURTS, RATE_BANDS } from "./content.mjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const db = new pg.Client({ connectionString: url });
await db.connect();

const config = {
  courtName: "Chateau Katriannah",
  tagline: "Pickleball Club",
  logoUrl: "/brand/logo.png",
  currencySymbol: "₱",
  contactNumber: process.env.SEED_PHONE || "",
  emailAddress: process.env.SEED_EMAIL || "",
  slotMinutes: 60,
  bookingWindowDays: 60,
  bookingFee: 10,
  bookingFeePerHour: false,
  paymentWindowMinutes: 5,
  partialPaymentEnabled: false,
  partialPaymentPercent: 50,
  emailSendingEnabled: false,
  adminEmail: process.env.ADMIN_EMAIL || "",
  payment: {
    bankName: "GCash",
    accountName: "Chateau Katriannah Pickleball Club",
    accountNumber: "09XX XXX XXXX",
    qrUrl: "/brand/payment-qr.png",
  },
  paymentAlt: {
    bankName: "Maya",
    accountName: "Chateau Katriannah Pickleball Club",
    accountNumber: "",
    qrUrl: "/brand/maya-qr.jpg",
  },
  gallery: ["/images/hero.jpg", "/images/court-2.jpg", "/images/court-3.jpg", "/images/court-4.jpg", "/images/court-5.jpg"],
  slotColors: {},
  showRateSeparators: true,
  ...content,
  ...(process.env.SEED_ADDRESS ? { locationText: process.env.SEED_ADDRESS } : {}),
  ...(process.env.SEED_MAPS_URL ? { mapsUrl: process.env.SEED_MAPS_URL } : {}),
  ...(process.env.SEED_FACEBOOK ? { facebookPage: process.env.SEED_FACEBOOK } : {}),
};

const { rows: existing } = await db.query("SELECT 1 FROM settings WHERE key='config'");
if (!existing.length) {
  await db.query("INSERT INTO settings(key,value) VALUES('config',$1)", [config]);
  console.log("config seeded");
}

const { rows: courts } = await db.query("SELECT count(*)::int AS n FROM courts");
if (courts[0].n === 0) {
  for (const c of COURTS) await db.query("INSERT INTO courts(name,kind,sort) VALUES($1,$2,$3)", [c.name, c.kind, c.sort]);
  console.log("courts seeded");
}

const { rows: bands } = await db.query("SELECT count(*)::int AS n FROM rate_bands");
if (bands[0].n === 0) {
  for (const b of RATE_BANDS) {
    await db.query("INSERT INTO rate_bands(name,start_hour,end_hour,price,sort) VALUES($1,$2,$3,$4,$5)", [b.name, b.start_hour, b.end_hour, b.price, b.sort]);
  }
  console.log("rate bands seeded");
}

await db.query(`INSERT INTO equipment(slug,name,unit,price,inventory_total)
  VALUES ('paddle','Paddle','paddle',50,4) ON CONFLICT (slug) DO NOTHING`);

if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
  await db.query(
    `INSERT INTO admin_users(email,password_hash,role) VALUES($1,$2,'owner')
     ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, role='owner'`,
    [process.env.ADMIN_EMAIL.toLowerCase(), hash]
  );
  console.log("admin user ready:", process.env.ADMIN_EMAIL);
} else {
  console.log("ADMIN_EMAIL/ADMIN_PASSWORD not set — no admin user created");
}

await db.end();
console.log("seed complete");
