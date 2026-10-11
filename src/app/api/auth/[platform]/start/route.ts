import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { LOCAL_PORT, OAUTH_RELAY_URL } from "@/lib/paths";
import { providers } from "@/lib/publish";
import { PLATFORMS, type Platform } from "@/lib/types";

export async function GET(_req: Request, ctx: RouteContext<"/api/auth/[platform]/start">) {
  const platform = (await ctx.params).platform as Platform;
  if (!PLATFORMS.includes(platform)) return new Response("Unknown platform", { status: 404 });
  if (!providers[platform].configured()) {
    return new Response(`Add the ${platform} app credentials to .env.local first (see README).`, { status: 400 });
  }
  // With a relay page the state carries the local port, so the page knows where to forward the callback
  const state = randomBytes(16).toString("hex") + (OAUTH_RELAY_URL ? `.${LOCAL_PORT}` : "");
  const res = NextResponse.redirect(providers[platform].authUrl(state));
  res.cookies.set(`oauth_${platform}`, state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
