import { cancelJob } from "@/lib/jobs";

export async function POST(_req: Request, ctx: RouteContext<"/api/jobs/[id]/cancel">) {
  return Response.json({ ok: cancelJob((await ctx.params).id) });
}
