import { getJob } from "@/lib/jobs";

export async function GET(_req: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  const job = getJob((await ctx.params).id);
  return job ? Response.json(job) : Response.json({ error: "Not found" }, { status: 404 });
}
