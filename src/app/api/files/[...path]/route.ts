import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { readUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Serves files from DATA_DIR. Receipts are admin-only; everything else (e.g. uploaded payment QR) is public. */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const rel = path.join("/");
  if (rel.startsWith("receipts/")) {
    const s = await getSession();
    if (!s) return new NextResponse("Unauthorized", { status: 401 });
  }
  const f = await readUpload(rel);
  if (!f) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(f.buf), { headers: { "content-type": f.type, "cache-control": "private, max-age=3600" } });
}
