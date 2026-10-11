import { saveConnection } from "@/lib/store";
import { PLATFORMS, type Platform } from "@/lib/types";

export async function POST(_req: Request, ctx: RouteContext<"/api/auth/[platform]/disconnect">) {
  const platform = (await ctx.params).platform as Platform;
  if (!PLATFORMS.includes(platform)) return new Response("Unknown platform", { status: 404 });
  saveConnection(platform, undefined);
  return Response.json({ ok: true });
}
