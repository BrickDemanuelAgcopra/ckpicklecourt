import nodemailer from "nodemailer";
import { getConfig } from "./config";
import { hourLabel, longDate } from "./time";
import { money } from "./format";
import type { BookingDetail, PaymentMethod, SiteConfig } from "./types";

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

/** Sends one plain-text email. Returns false when email is off or sending failed. */
export async function sendMail(to: string | string[], subject: string, text: string): Promise<boolean> {
  const cfg = await getConfig();
  const t = transport();
  const list = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!t || !cfg.emailSendingEnabled || !list.length) return false;
  try {
    await t.sendMail({ from: process.env.SMTP_FROM || `${cfg.courtName} <no-reply@ckpicklecourt.com>`, to: list, subject, text });
    return true;
  } catch (e) {
    console.error("email failed", e);
    return false;
  }
}

const METHOD: Record<PaymentMethod, string> = { gcash: "GCash", maya: "Maya", cash: "cash", bank: "bank transfer", other: "other" };

/** "Court 1: Saturday, October 31, 2026 6:00 PM – 8:00 PM", back-to-back hours merged into one line. */
function slotLines(b: BookingDetail): string {
  const lines: string[] = [];
  const slots = [...b.slots].sort((x, y) => x.date.localeCompare(y.date) || x.court_name.localeCompare(y.court_name) || x.hour - y.hour);
  for (let i = 0; i < slots.length; ) {
    const s = slots[i];
    let end = s.hour + 1;
    let j = i + 1;
    while (j < slots.length && slots[j].date === s.date && slots[j].court_id === s.court_id && slots[j].hour === end) end = slots[j++].hour + 1;
    lines.push(`${s.court_name}: ${longDate(s.date)} ${hourLabel(s.hour)} – ${hourLabel(end)}`);
    i = j;
  }
  return lines.join("\n");
}

function moneyLines(b: BookingDetail, cfg: SiteConfig): string {
  const sym = cfg.currencySymbol;
  const due = Math.max(Number(b.total) - b.paid, 0);
  let s = `Total: ${money(b.total, sym)}`;
  if (b.paid > 0) s += `\nPaid: ${money(b.paid, sym)}` + (due > 0 ? `\nBalance to pay at the court: ${money(due, sym)}` : " (fully paid)");
  return s;
}

function contactLine(cfg: SiteConfig): string {
  const ways = [cfg.contactNumber, cfg.facebookPage].filter(Boolean);
  return ways.length ? `Questions? Message us: ${ways.join(" · ")}\n\n` : "";
}

export type BookingEmailKind = "submitted" | "confirmed" | "declined" | "cancelled" | "payment" | "reminder";

/** Guest emails about one booking ("submitted" also alerts the admin). Silently skips when email is off. */
export async function sendBookingEmail(kind: BookingEmailKind, b: BookingDetail, payment?: { amount: number; method: PaymentMethod }): Promise<boolean> {
  const cfg = await getConfig();
  const sym = cfg.currencySymbol;
  const tracking = `${siteUrl()}/bookings/${b.id}`;
  const subject = {
    submitted: `We received your booking ${b.confirmation_id}`,
    confirmed: `Your booking ${b.confirmation_id} is confirmed`,
    declined: `Your booking ${b.confirmation_id} was not approved`,
    cancelled: `Your booking ${b.confirmation_id} was cancelled`,
    payment: `Payment received for booking ${b.confirmation_id}`,
    reminder: `Reminder: you're playing tomorrow at ${cfg.courtName}`,
  }[kind];
  const intro = {
    submitted: "Thanks for your booking. We'll review your receipt and confirm shortly.",
    confirmed: `Your court is confirmed. See you at ${cfg.courtName}!`,
    declined: "We couldn't verify the payment for this booking, so it was not approved. Please message us if you think this is a mistake.",
    cancelled: "This booking has been cancelled and its hours released. If you already paid, please message us about your payment.",
    payment: payment
      ? `We received ${money(payment.amount, sym)} by ${METHOD[payment.method]}. Thank you!`
      : "We received your payment. Thank you!",
    reminder: `See you tomorrow on the court!${cfg.locationText ? `\n\nWhere: ${cfg.locationText}` : ""}${cfg.mapsUrl ? `\nMap: ${cfg.mapsUrl}` : ""}`,
  }[kind];
  const body =
    `Hi ${b.guest_name},\n\n${intro}\n\n` +
    `Booking reference: ${b.confirmation_id}\n${slotLines(b)}\n${moneyLines(b, cfg)}\n\n` +
    (kind === "cancelled" ? "" : `Track your booking anytime: ${tracking}\n\n`) +
    contactLine(cfg) +
    cfg.courtName;

  const to: string[] = [];
  if (b.guest_email) to.push(b.guest_email);
  if (kind === "submitted" && cfg.adminEmail) to.push(cfg.adminEmail);
  return sendMail(to, subject, body);
}
