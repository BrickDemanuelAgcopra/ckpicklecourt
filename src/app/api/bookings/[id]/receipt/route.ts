import { NextResponse } from "next/server";
import { BookingError, getBooking, submitReceipt } from "@/lib/bookings";
import { readUpload, saveUpload } from "@/lib/storage";
import { sendBookingEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/** The guest's own receipt. The booking UUID in the private tracking link is the access key. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await getBooking(id);
  const f = b?.receipt_path ? await readUpload(b.receipt_path) : null;
  if (!f) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(f.buf), {
    headers: { "content-type": f.type, "cache-control": "private, max-age=3600", "x-robots-tag": "noindex", "content-disposition": "inline" },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const form = await req.formData();
  const file = form.get("receipt");
  const partial = form.get("partial") === "1";
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Please attach your payment receipt." }, { status: 400 });
  try {
    const rel = await saveUpload(`receipts/${id.slice(0, 2)}`, file);
    const b = await submitReceipt(id, rel, partial);
    sendBookingEmail("submitted", b).catch(() => {});
    return NextResponse.json({ ok: true, confirmationId: b.confirmation_id });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
