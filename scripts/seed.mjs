// Seeds the club configuration, courts, rate bands, equipment and the first admin.
// Idempotent: safe to run again. Usage: node scripts/seed.mjs
import pg from "pg";
import bcrypt from "bcryptjs";

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
  locationText: process.env.SEED_ADDRESS || "Chateau Katriannah, Cagayan de Oro City, Misamis Oriental, Philippines, 9000",
  mapsUrl: process.env.SEED_MAPS_URL || "https://www.google.com/maps?q=Chateau+Katriannah+Pickleball+Club",
  contactNumber: process.env.SEED_PHONE || "",
  emailAddress: process.env.SEED_EMAIL || "",
  facebookPage: process.env.SEED_FACEBOOK || "",
  openingHoursText: "Open 6:00 AM - 12:00 MN daily",
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
  gallery: ["/images/hero.jpg", "/images/court-2.jpg", "/images/court-3.jpg", "/images/court-4.jpg", "/images/court-5.jpg"],
  heroFacts: [
    { icon: "calendar", text: "Open every day" },
    { icon: "grid", text: "3 courts" },
    { icon: "pin", text: "" },
  ],
  courtDetails: [
    { id: "surface", title: "Court Surface", text: "Three outdoor pickleball courts with a premium acrylic silica-sand finish for sure footing, consistent play and a true bounce. Each court is generously spaced so you have room to move." },
    { id: "lighting", title: "Lighting", text: "LED floodlights give even, glare-free light for night sessions until midnight." },
    { id: "amenities", title: "Amenities", text: "Shaded viewing area for players and spectators\nClean comfort rooms\nParking for cars and motorcycles" },
    { id: "hours", title: "Operating Hours", text: "Monday - Sunday | 6:00 A.M. - 12:00 M.N." },
    { id: "last-booking", title: "Last Booking Time", text: "11:00 P.M." },
  ],
  policies: [
    { id: "reservation", title: "Reservation Policy", text: "To secure your preferred schedule, full payment is required upon making a reservation. This keeps booking availability fair and minimizes non-serious reservations." },
    { id: "weather", title: "Weather & Rescheduling Policy", text: "Our courts are open-air, so playing conditions may be affected by rain. In light rain, games may continue at the players' discretion. During heavy rain or unsafe conditions, play may be paused or rescheduled.\n\nRescheduling is allowed for confirmed and fully paid bookings, subject to court availability. Please notify us as early as possible." },
    { id: "safety", title: "Safety & Personal Belongings", text: "Players are responsible for their own safety and personal belongings while on the premises. Management is not liable for any injury, accident, loss, theft or damage. By making a reservation and using the premises, players acknowledge and accept these risks." },
    { id: "claygo", title: "CLAYGO Policy", text: "Please practice Clean As You Go. Dispose of trash properly, collect your belongings and leave the court ready for the next players. Thank you for keeping Chateau Katriannah clean and pleasant for everyone!" },
  ],
  faqs: [
    { q: "How do I book a court?", a: "Pick a date and open hours, fill in your details, pay by scanning the QR code, then upload your receipt. We confirm once it's reviewed." },
    { q: "Do I need to pay before my booking is confirmed?", a: "Yes. After selecting your slots you have a few minutes to upload your payment receipt, after which the hold is released." },
    { q: "Can I cancel or reschedule?", a: "Rescheduling is allowed for confirmed, fully paid bookings subject to availability. Message us as early as possible." },
    { q: "Is parking available?", a: "Yes, there is parking for cars and motorcycles on site." },
  ],
  slotColors: {},
  showRateSeparators: true,
};

const { rows: existing } = await db.query("SELECT 1 FROM settings WHERE key='config'");
if (!existing.length) {
  await db.query("INSERT INTO settings(key,value) VALUES('config',$1)", [config]);
  console.log("config seeded");
}

const { rows: courts } = await db.query("SELECT count(*)::int AS n FROM courts");
if (courts[0].n === 0) {
  await db.query(`INSERT INTO courts(name,kind,sort) VALUES ('Court 1','outdoor',1),('Court 2','outdoor',2),('Court 3','outdoor',3)`);
  console.log("courts seeded");
}

const { rows: bands } = await db.query("SELECT count(*)::int AS n FROM rate_bands");
if (bands[0].n === 0) {
  await db.query(`INSERT INTO rate_bands(name,start_hour,end_hour,price,sort) VALUES
    ('Morning',6,9,400,1),
    ('Afternoon & Evening',15,24,450,2)`);
  console.log("rate bands seeded");
}

await db.query(`INSERT INTO equipment(slug,name,unit,price,inventory_total)
  VALUES ('paddle','Paddle','paddle',50,4) ON CONFLICT (slug) DO NOTHING`);

if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
  await db.query(
    `INSERT INTO admin_users(email,password_hash) VALUES($1,$2)
     ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash`,
    [process.env.ADMIN_EMAIL.toLowerCase(), hash]
  );
  console.log("admin user ready:", process.env.ADMIN_EMAIL);
} else {
  console.log("ADMIN_EMAIL/ADMIN_PASSWORD not set — no admin user created");
}

await db.end();
console.log("seed complete");
