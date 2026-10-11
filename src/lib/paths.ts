import path from "node:path";

export const SHORTS_DIR = path.resolve(process.env.SHORTS_DIR || path.join(process.cwd(), "../shorts-maker"));
export const OUTPUT_DIR = path.join(SHORTS_DIR, "output");
export const TOPICS_FILE = path.join(SHORTS_DIR, "topics.txt");
export const TOPICS_DONE_FILE = path.join(SHORTS_DIR, "topics-done.txt");
export const PYTHON_BIN = process.env.PYTHON_BIN || path.join(SHORTS_DIR, ".venv/bin/python");
export const DATA_DIR = path.join(process.cwd(), "data");

export const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

// Optional static https page (e.g. GitHub Pages, see docs/oauth) that forwards OAuth callbacks to this machine,
// so Instagram and TikTok get a permanent https redirect URI instead of a tunnel URL that changes every run.
export const OAUTH_RELAY_URL = process.env.OAUTH_RELAY_URL?.replace(/\/$/, "");
export const LOCAL_PORT = process.env.PORT || "3000";
const LOCAL_URL = `http://localhost:${LOCAL_PORT}`;
/** Where the browser lands after an OAuth callback: the relay always forwards to localhost. */
export const OAUTH_RETURN_URL = OAUTH_RELAY_URL ? LOCAL_URL : APP_URL;

export function oauthRedirectUri(platform: "youtube" | "instagram" | "tiktok") {
  if (!OAUTH_RELAY_URL) return `${APP_URL}/api/auth/${platform}/callback`;
  // Google accepts http://localhost redirect URIs, so YouTube skips the relay
  if (platform === "youtube") return `${LOCAL_URL}/api/auth/youtube/callback`;
  return `${OAUTH_RELAY_URL}/${platform}.html`;
}

/** Resolve a path inside OUTPUT_DIR, refusing anything that escapes it. */
export function outputPath(...parts: string[]): string {
  const full = path.resolve(OUTPUT_DIR, ...parts);
  if (full !== OUTPUT_DIR && !full.startsWith(OUTPUT_DIR + path.sep)) {
    throw new Error("Invalid path");
  }
  return full;
}
