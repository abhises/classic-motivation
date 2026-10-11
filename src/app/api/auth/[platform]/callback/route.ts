import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_RETURN_URL } from "@/lib/paths";
import { providers } from "@/lib/publish";
import { saveConnection } from "@/lib/store";
import { PLATFORMS, type Platform } from "@/lib/types";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/auth/[platform]/callback">) {
  const platform = (await ctx.params).platform as Platform;
  if (!PLATFORMS.includes(platform)) return new Response("Unknown platform", { status: 404 });
  const q = req.nextUrl.searchParams;
  const back = (msg: string) => {
    const res = NextResponse.redirect(`${OAUTH_RETURN_URL}/accounts?${new URLSearchParams({ platform, msg })}`);
    res.cookies.delete(`oauth_${platform}`);
    return res;
  };

  if (q.get("error")) return back(`Authorization failed: ${q.get("error_description") || q.get("error")}`);
  const state = q.get("state");
  if (!state || state !== req.cookies.get(`oauth_${platform}`)?.value) {
    return back("Authorization failed: state mismatch, please try again");
  }
  try {
    // Instagram appends "#_" to the code
    const code = (q.get("code") ?? "").replace(/#_$/, "");
    saveConnection(platform, await providers[platform].exchangeCode(code, state));
    return back("connected");
  } catch (e) {
    return back(`Authorization failed: ${e instanceof Error ? e.message : e}`);
  }
}
