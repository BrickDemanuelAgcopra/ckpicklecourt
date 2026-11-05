import nodemailer from "nodemailer";
import { extname } from "node:path";
import { readUpload } from "./storage";
import { getConfig } from "./config";
import { hourLabel, longDate } from "./time";
import { money } from "./format";
import type { BookingDetail, PaymentMethod, SiteConfig } from "./types";
import { renderBookingEmailHtml, type BookingEmailView, type EmailRow, type Tone } from "./emailTemplate";

function transport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

export function siteUrl(): string {
  return (process.env.SITE_URL || "https://ckpicklecourt.com").replace(/\/$/, "");
}

/** True when SMTP is configured and "Send confirmation emails" is on in Admin → Settings. */
export async function emailEnabled(): Promise<boolean> {
  return Boolean(process.env.SMTP_HOST) && (await getConfig()).emailSendingEnabled;
}

type MailExtras = { html?: string; replyTo?: string; attachments?: { filename: string; content: Buffer; contentType: string }[] };

/** Sends one email (plain text, plus HTML/attachments when given). Returns false when email is off or sending failed. */
export async function sendMail(to: string | string[], subject: string, text: string, extras: MailExtras = {}): Promise<boolean> {
  const cfg = await getConfig();
  const t = transport();
  const list = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!t || !cfg.emailSendingEnabled || !list.length) return false;
  try {
    await t.sendMail({ from: process.env.SMTP_FROM || `${cfg.courtName} <no-reply@ckpicklecourt.com>`, to: list, subject, text, ...extras });
    return true;
  } catch (e) {
    console.error("email failed", e);
    return false;
  }
}

const METHOD: Record<PaymentMethod, string> = { gcash: "GCash", maya: "Maya", cash: "Cash", bank: "Bank transfer", other: "Other" };

/** Back-to-back hours on the same court and day merged into one entry. */
export function scheduleBlocks(b: BookingDetail): { court: string; date: string; time: string }[] {
  const out: { court: string; date: string; time: string }[] = [];
  const slots = [...b.slots].sort((x, y) => x.date.localeCompare(y.date) || x.court_name.localeCompare(y.court_name) || x.hour - y.hour);
  for (let i = 0; i < slots.length; ) {
    const s = slots[i];
    let end = s.hour + 1;
    let j = i + 1;
    while (j < slots.length && slots[j].date === s.date && slots[j].court_id === s.court_id && slots[j].hour === end) end = slots[j++].hour + 1;
    const hrs = end - s.hour;
    out.push({ court: s.court_name, date: longDate(s.date), time: `${hourLabel(s.hour)} – ${hourLabel(end)} (${hrs} ${hrs === 1 ? "hour" : "hours"})` });
    i = j;
  }
  return out;
}

function stamp(ts: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(ts));
}

function absUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? u : `${siteUrl()}${u.startsWith("/") ? "" : "/"}${u}`;
}

export type BookingEmailKind = "submitted" | "confirmed" | "declined" | "cancelled" | "payment" | "reminder";

const LOOK: Record<BookingEmailKind, { badge: string; tone: Tone; heading: string }> = {
  submitted: { badge: "Booking received", tone: "gold", heading: "We got your booking" },
  confirmed: { badge: "Confirmed", tone: "green", heading: "You're all set!" },
  declined: { badge: "Not approved", tone: "red", heading: "We couldn't confirm your booking" },
  cancelled: { badge: "Cancelled", tone: "grey", heading: "Your booking was cancelled" },
  payment: { badge: "Payment received", tone: "green", heading: "Thank you for your payment" },
  reminder: { badge: "See you tomorrow", tone: "green", heading: "You're playing tomorrow" },
};

type Payment = { amount: number; method: PaymentMethod };

function buildView(kind: BookingEmailKind, b: BookingDetail, cfg: SiteConfig, payment?: Payment): BookingEmailView & { subject: string } {
  const m = (n: number | string) => money(n, cfg.currencySymbol);
  const total = Number(b.total);
  const due = Math.max(total - b.paid, 0);
  const live = kind !== "declined" && kind !== "cancelled";
  const schedule = scheduleBlocks(b);

  const subject = {
    submitted: `We received your booking ${b.confirmation_id}`,
    confirmed: `Your booking ${b.confirmation_id} is confirmed`,
    declined: `Your booking ${b.confirmation_id} was not approved`,
    cancelled: `Your booking ${b.confirmation_id} was cancelled`,
    payment: `Payment received for booking ${b.confirmation_id}`,
    reminder: `Reminder: you're playing tomorrow at ${cfg.courtName}`,
  }[kind];

  const intro = {
    submitted: ["Thanks for booking with us! We're checking your payment receipt now and will email you as soon as your court is confirmed."],
    confirmed: [
      `Your court is confirmed. We can't wait to see you at ${cfg.courtName}!`,
      ...(due > 0 ? [`Please settle the remaining ${m(due)} at the court before you play.`] : []),
    ],
    declined: [
      "We couldn't verify the payment for this booking, so it was not approved and the hours were released.",
      "If you think this is a mistake, please message us with your booking reference.",
    ],
    cancelled: ["This booking has been cancelled and its hours released.", "If you already paid, please message us about your payment."],
    payment: [payment ? `We received ${m(payment.amount)} by ${METHOD[payment.method]}. This email is your receipt.` : "We received your payment. This email is your receipt."],
    reminder: ["Just a friendly reminder that your court is booked for tomorrow. Please arrive a few minutes early to warm up."],
  }[kind];

  const charges: EmailRow[] = [{ label: "Court fees", value: m(b.subtotal) }];
  if (Number(b.equipment_total) > 0) charges.push({ label: "Equipment rental", value: m(b.equipment_total) });
  if (Number(b.booking_fee) > 0) charges.push({ label: "Booking fee", value: m(b.booking_fee) });
  charges.push({ label: "Total", value: m(total), strong: true });

  const settlement: EmailRow[] = [];
  if (live && b.paid > 0) {
    settlement.push({ label: "Paid", value: m(b.paid), tone: "green" });
    settlement.push(
      due > 0 ? { label: "Balance to pay at the court", value: m(due), strong: true, tone: "gold" } : { label: "Paid in full", value: "✓", strong: true, tone: "green" }
    );
  }

  let receipt: BookingEmailView["receipt"];
  if (kind === "payment") {
    const last =
      [...b.payments].reverse().find((p) => !payment || (Number(p.amount) === Number(payment.amount) && p.method === payment.method)) ?? b.payments.at(-1);
    const rows: EmailRow[] = [
      { label: "Amount received", value: m(payment?.amount ?? last?.amount ?? 0) },
      { label: "Payment method", value: METHOD[payment?.method ?? last?.method ?? "other"] },
    ];
    if (last?.reference) rows.push({ label: "Reference no.", value: last.reference });
    if (last?.received_at) rows.push({ label: "Date received", value: stamp(last.received_at) });
    rows.push({ label: "Remaining balance", value: m(due), strong: true, tone: due > 0 ? "gold" : "green" });
    receipt = { title: "Payment receipt", rows };
  }

  // On a payment email with a single payment, the receipt block already says it all.
  const showPayments = live && b.payments.length > 0 && !(kind === "payment" && b.payments.length === 1);

  return {
    subject,
    preheader: `${LOOK[kind].badge} · Ref ${b.confirmation_id}${schedule.length ? ` · ${schedule[0].date}` : ""}`,
    ...LOOK[kind],
    greeting: `Hi ${b.guest_name},`,
    intro,
    reference: b.confirmation_id,
    schedule,
    equipment: b.equipment.map((e) => ({
      name: e.name,
      detail: `${e.qty} × ${m(e.unit_price)}${e.unit ? ` / ${e.unit}` : ""}`,
      amount: m(e.qty * Number(e.unit_price)),
    })),
    charges,
    settlement,
    receipt,
    payments: showPayments
      ? b.payments.map((p) => ({ date: stamp(p.received_at), method: METHOD[p.method] ?? p.method, reference: p.reference ?? "", amount: m(p.amount) }))
      : [],
    location: (kind === "confirmed" || kind === "reminder") && cfg.locationText ? { text: cfg.locationText, mapsUrl: cfg.mapsUrl } : undefined,
    cta: kind === "cancelled" ? undefined : { label: "View your booking", url: `${siteUrl()}/bookings/${b.id}` },
    courtName: cfg.courtName,
    tagline: cfg.tagline,
    // The full-size logo is ~1.6 MB; the 180px icon is plenty at 84px and loads fast in inboxes.
    logoUrl: !cfg.logoUrl || cfg.logoUrl === "/brand/logo.png" ? absUrl("/brand/apple-touch-icon.png") : absUrl(cfg.logoUrl),
    siteUrl: siteUrl(),
    contact: { phone: cfg.contactNumber, email: cfg.emailAddress, facebook: cfg.facebookPage },
  };
}

/** Plain-text twin of the HTML email, for clients that don't show HTML. */
function plainText(v: BookingEmailView): string {
  const rows = (r: EmailRow[]) => r.map((x) => `${x.label}: ${x.value}`).join("\n");
  const ways = [v.contact.phone, v.contact.email, v.contact.facebook].filter(Boolean);
  return [
    v.greeting,
    v.intro.join("\n\n"),
    `Booking reference: ${v.reference}`,
    v.receipt ? `${v.receipt.title.toUpperCase()}\n${rows(v.receipt.rows)}` : "",
    v.schedule.map((s) => `${s.court}: ${s.date}, ${s.time}`).join("\n"),
    v.equipment.map((e) => `${e.name} (${e.detail}): ${e.amount}`).join("\n"),
    rows([...v.charges, ...v.settlement]),
    v.payments.length ? "Payments received:\n" + v.payments.map((p) => `${p.date} · ${p.method}${p.reference ? ` · Ref ${p.reference}` : ""} · ${p.amount}`).join("\n") : "",
    v.location ? `Where: ${v.location.text}${v.location.mapsUrl ? `\nMap: ${v.location.mapsUrl}` : ""}` : "",
    v.cta ? `${v.cta.label}: ${v.cta.url}` : "",
    ways.length ? `Questions? Message us: ${ways.join(" · ")}` : "",
    v.courtName,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Builds a booking email without sending it. */
export async function renderBookingEmail(kind: BookingEmailKind, b: BookingDetail, payment?: Payment, cfg?: SiteConfig) {
  const v = buildView(kind, b, cfg ?? (await getConfig()), payment);
  return { subject: v.subject, text: plainText(v), html: renderBookingEmailHtml(v) };
}

/** The owner's "new booking to review" alert: guest contact details, the receipt attached, and a link into Admin. */
export function renderAdminNewBookingEmail(b: BookingDetail, cfg: SiteConfig) {
  const v = buildView("submitted", b, cfg);
  const m = (n: number | string) => money(n, cfg.currencySymbol);
  const total = Number(b.total);
  const expected = b.partial_payment && b.partial_percent ? Math.round((total * b.partial_percent) / 100) : total;
  const slotCount = b.slots.length;
  const guest: EmailRow[] = [
    { label: "Name", value: b.guest_name },
    { label: "Phone", value: b.guest_phone || "—" },
    { label: "Email", value: b.guest_email || "—" },
    { label: "Paying now", value: b.partial_payment && b.partial_percent ? `${b.partial_percent}% deposit` : "Full amount" },
    { label: "Amount to check on receipt", value: m(expected), strong: true, tone: "gold" },
  ];
  const adminUrl = `${siteUrl()}/admin/bookings?view=review&q=${encodeURIComponent(b.confirmation_id)}`;
  const view: BookingEmailView = {
    ...v,
    preheader: `${b.guest_name} · ${slotCount} ${slotCount === 1 ? "hour" : "hours"} · ${m(total)} · receipt attached`,
    badge: "New booking",
    tone: "gold",
    heading: "New booking to review",
    greeting: "Hi,",
    intro: [`${b.guest_name} just booked and uploaded a payment receipt. Check that the payment arrived, then confirm or decline the booking in Admin.`],
    receipt: { title: "Guest details", rows: guest },
    scheduleTitle: v.schedule.length > 1 ? "Court times" : "Court time",
    payments: [],
    settlement: [],
    location: undefined,
    cta: { label: "Review in Admin", url: adminUrl },
    secondaryCta: b.receipt_path ? { label: "View receipt", url: `${siteUrl()}/api/bookings/${b.id}/receipt` } : undefined,
    contact: { phone: "", email: "", facebook: "" },
    footerNote: `You're receiving this as the admin of ${cfg.courtName}. Change the alert address in Admin → Settings.`,
  };
  const subject = `New booking ${b.confirmation_id} from ${b.guest_name} (${m(total)})`;
  return { subject, text: plainText(view), html: renderBookingEmailHtml(view) };
}

async function sendAdminNewBookingEmail(b: BookingDetail, cfg: SiteConfig): Promise<boolean> {
  if (!cfg.adminEmail) return false;
  const { subject, text, html } = renderAdminNewBookingEmail(b, cfg);
  const attachments: MailExtras["attachments"] = [];
  const f = b.receipt_path ? await readUpload(b.receipt_path).catch(() => null) : null;
  if (f) attachments.push({ filename: `receipt-${b.confirmation_id}${extname(b.receipt_path!) || ""}`, content: f.buf, contentType: f.type });
  return sendMail(cfg.adminEmail, subject, text, { html, attachments, ...(b.guest_email ? { replyTo: b.guest_email } : {}) });
}

/** Guest emails about one booking. "submitted" also sends the owner a separate alert. Silently skips when email is off. */
export async function sendBookingEmail(kind: BookingEmailKind, b: BookingDetail, payment?: Payment): Promise<boolean> {
  const cfg = await getConfig();
  const { subject, text, html } = await renderBookingEmail(kind, b, payment, cfg);
  const [guestSent] = await Promise.all([
    b.guest_email ? sendMail(b.guest_email, subject, text, { html }) : Promise.resolve(false),
    kind === "submitted" ? sendAdminNewBookingEmail(b, cfg) : Promise.resolve(false),
  ]);
  return guestSent;
}

