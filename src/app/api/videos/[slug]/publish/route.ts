import { getVideo } from "@/lib/library";
import { publishVideo } from "@/lib/publish";
import { PLATFORMS, type Platform } from "@/lib/types";

/** Starts the upload in the background; progress shows up in the video's `published` field. */
export async function POST(req: Request, ctx: RouteContext<"/api/videos/[slug]/publish">) {
  const { slug } = await ctx.params;
  const { platform } = (await req.json()) as { platform: Platform };
  if (!PLATFORMS.includes(platform)) return Response.json({ error: "Unknown platform" }, { status: 400 });
  if (!getVideo(slug)) return Response.json({ error: "Video not found" }, { status: 404 });
  publishVideo(slug, platform).catch((e) => console.error(`[publish ${platform}]`, e));
  return Response.json({ ok: true });
}
