import nodemailer from "nodemailer";
import { getConfig } from "./config";
import { hourLabel, longDate } from "./time";
import type { BookingDetail } from "./types";

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

function slotLines(b: BookingDetail): string {
  return b.slots.map((s) => `${s.court_name}: ${longDate(s.date)} ${hourLabel(s.hour)} – ${hourLabel(s.hour + 1)}`).join("\n");
}

/** Sends when SMTP is configured and emailSendingEnabled is on; otherwise silently skips. */
export async function sendBookingEmail(kind: "submitted" | "confirmed" | "declined", b: BookingDetail) {
  const cfg = await getConfig();
  const t = transport();
  if (!t || !cfg.emailSendingEnabled) return;
  const from = process.env.SMTP_FROM || `${cfg.courtName} <no-reply@ckpicklecourt.com>`;
  const tracking = `${siteUrl()}/bookings/${b.id}`;
  const subject = {
    submitted: `We received your booking ${b.confirmation_id}`,
    confirmed: `Your booking ${b.confirmation_id} is confirmed`,
    declined: `Your booking ${b.confirmation_id} was not approved`,
  }[kind];
  const body =
    `Hi ${b.guest_name},\n\n` +
    (kind === "submitted"
      ? "Thanks for your booking. We'll review your receipt and confirm shortly.\n\n"
      : kind === "confirmed"
        ? "Your court is confirmed. See you at Chateau Katriannah!\n\n"
        : "We couldn't verify the payment for this booking, so it was not approved. Please message us if you think this is a mistake.\n\n") +
    `Booking reference: ${b.confirmation_id}\n${slotLines(b)}\nTotal: ${cfg.currencySymbol}${Number(b.total).toLocaleString()}\n\n` +
    `Track your booking anytime: ${tracking}\n\n${cfg.courtName}`;

  const to: string[] = [];
  if (b.guest_email) to.push(b.guest_email);
  if (kind === "submitted" && cfg.adminEmail) to.push(cfg.adminEmail);
  if (!to.length) return;
  try {
    await t.sendMail({ from, to, subject, text: body });
  } catch (e) {
    console.error("email failed", e);
  }
}
