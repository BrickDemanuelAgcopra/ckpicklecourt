import { NextResponse } from "next/server";
import { getMessages, threadExists } from "@/lib/chat";

export const dynamic = "force-dynamic";

/** The guest's conversation (the thread UUID kept in their browser is the access key). ?after=<id> returns only newer messages. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!(await threadExists(id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const after = Math.max(0, Number(new URL(req.url).searchParams.get("after")) || 0);
  return NextResponse.json({ messages: await getMessages(id, after) }, { headers: { "cache-control": "no-store" } });
}
