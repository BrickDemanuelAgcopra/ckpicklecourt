import { query } from "./db";

export type AuditAction =
  | "booking_submitted"
  | "booking_confirmed"
  | "booking_confirmed_partial"
  | "balance_settled"
  | "booking_declined"
  | "booking_cancelled"
  | "booking_expired"
  | "booking_hour_removed"
  | "dirty_bookings_deleted"
  | "slot_closed"
  | "slot_reopened"
  | "promo_created"
  | "promo_updated"
  | "promo_deleted"
  | "open_play_created"
  | "open_play_cancelled"
  | "settings_updated"
  | "walkin_usage_saved"
  | "admin_login"
  | "payment_recorded"
  | "booking_created_admin";

export const AUDIT_LABELS: Record<AuditAction, string> = {
  booking_submitted: "Booking submitted",
  booking_confirmed: "Booking confirmed",
  booking_confirmed_partial: "Booking confirmed (partial payment)",
  balance_settled: "Balance settled",
  booking_declined: "Booking declined",
  booking_cancelled: "Booking cancelled",
  booking_expired: "Booking expired (payment timeout)",
  booking_hour_removed: "Booking hour removed",
  dirty_bookings_deleted: "Dirty bookings deleted",
  slot_closed: "Time slot closed",
  slot_reopened: "Time slot reopened",
  promo_created: "Promo created",
  promo_updated: "Promo updated",
  promo_deleted: "Promo deleted",
  open_play_created: "Open Play session created",
  open_play_cancelled: "Open Play session cancelled",
  settings_updated: "Booking settings updated",
  walkin_usage_saved: "Walk-in rental usage saved",
  admin_login: "Admin signed in",
  payment_recorded: "Payment recorded",
  booking_created_admin: "Booking entered by admin",
};

export async function audit(actor: string, action: AuditAction, entityType: string, entityId?: string | number | null, payload?: unknown) {
  await query("INSERT INTO audit_log(actor,action_type,entity_type,entity_id,payload) VALUES($1,$2,$3,$4,$5)", [
    actor,
    action,
    entityType,
    entityId == null ? null : String(entityId),
    payload == null ? null : JSON.stringify(payload),
  ]);
}
