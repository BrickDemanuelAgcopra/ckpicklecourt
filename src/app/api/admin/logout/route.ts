import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearSession();
  // Relative Location: req.url is the internal 0.0.0.0:3000 address behind the proxy
  return new NextResponse(null, { status: 303, headers: { Location: "/" } });
}
