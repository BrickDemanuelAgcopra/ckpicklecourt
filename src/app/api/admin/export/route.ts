import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Bookings as CSV (opens in Excel / Google Sheets). */
export async function GET() {
  const s = await getSession();
  if (!s) return new NextResponse("Unauthorized", { status: 401 });
  const rows = await query<Record<string, unknown>>(
    `SELECT b.confirmation_id, b.status, b.guest_name, b.guest_phone, b.guest_email, b.subtotal, b.equipment_total, b.booking_fee, b.total,
            b.partial_payment, b.created_at, b.submitted_at, b.confirmed_at, b.confirmed_by,
            string_agg(to_char(s.date,'YYYY-MM-DD') || ' ' || c.name || ' ' || s.hour || ':00', '; ' ORDER BY s.date, c.name, s.hour) AS schedule
       FROM bookings b
       LEFT JOIN booking_slots s ON s.booking_id = b.id
       LEFT JOIN courts c ON c.id = s.court_id
      WHERE b.status <> 'awaiting_payment'
      GROUP BY b.id ORDER BY b.created_at DESC`
  );
  const cols = ["confirmation_id", "status", "guest_name", "guest_phone", "guest_email", "schedule", "subtotal", "equipment_total", "booking_fee", "total", "partial_payment", "created_at", "submitted_at", "confirmed_at", "confirmed_by"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n");
  return new NextResponse("﻿" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
