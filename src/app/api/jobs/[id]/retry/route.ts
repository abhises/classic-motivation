import { retryJob } from "@/lib/jobs";

export async function POST(_req: Request, ctx: RouteContext<"/api/jobs/[id]/retry">) {
  return Response.json({ ok: retryJob((await ctx.params).id) });
}
