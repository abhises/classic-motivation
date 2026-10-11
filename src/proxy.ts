import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional password protection: set STUDIO_PASSWORD in .env.local before exposing the studio
 * through a tunnel (ngrok / cloudflared). Finished videos stay public so Instagram can fetch them,
 * and /terms and /privacy stay public for the platforms' app settings.
 */
export function proxy(req: NextRequest) {
  const password = process.env.STUDIO_PASSWORD;
  if (!password) return NextResponse.next();
  if (/^\/api\/media\/[^/]+\/final\.mp4$/.test(req.nextUrl.pathname)) return NextResponse.next();
  // Legal pages stay public so TikTok / Meta app settings can link to them
  if (req.nextUrl.pathname === "/terms" || req.nextUrl.pathname === "/privacy") return NextResponse.next();

  const auth = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded);
    if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Shorts Studio"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
