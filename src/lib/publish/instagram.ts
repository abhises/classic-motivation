import fs from "node:fs";
import { APP_URL } from "../paths";
import { getConnection, saveConnection, type Connection } from "../store";
import type { Plan } from "../types";
import { ApiError, fetchJson, form, sleep } from "./http";

// Uses "Instagram API with Instagram Login" (Business/Creator accounts, no Facebook Page needed).
const V = process.env.IG_GRAPH_VERSION || "v23.0";
const GRAPH = `https://graph.instagram.com/${V}`;

export const redirectUri = () => `${APP_URL}/api/auth/instagram/callback`;
export const configured = () => !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);

export function authUrl(state: string) {
  const q = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "instagram_business_basic,instagram_business_content_publish",
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${q}`;
}

export async function exchangeCode(code: string): Promise<Connection> {
  const { body, ...headers } = form({
    client_id: process.env.INSTAGRAM_APP_ID!,
    client_secret: process.env.INSTAGRAM_APP_SECRET!,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code,
  });
  const raw = await fetchJson<{ access_token?: string; data?: { access_token: string }[] }>(
    "https://api.instagram.com/oauth/access_token",
    { method: "POST", headers, body },
  );
  const short = raw.access_token ?? raw.data?.[0]?.access_token;
  if (!short) throw new ApiError("Instagram did not return an access token");

  const long = await fetchJson<{ access_token: string; expires_in: number }>(
    `https://graph.instagram.com/access_token?${new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      access_token: short,
    })}`,
  );
  const me = await fetchJson<{ id: string; user_id?: string; username?: string }>(
    `${GRAPH}/me?fields=user_id,username&access_token=${encodeURIComponent(long.access_token)}`,
  );
  return {
    accessToken: long.access_token,
    expiresAt: Date.now() + long.expires_in * 1000,
    userId: me.user_id ?? me.id,
    account: me.username ? `@${me.username}` : "Instagram account",
    obtainedAt: Date.now(),
  };
}

/** Long-lived tokens last 60 days; refresh once they're over a day old and within 30 days of expiry. */
async function connection(): Promise<Connection> {
  const c = getConnection("instagram");
  if (!c?.userId) throw new ApiError("Instagram is not connected");
  if (c.expiresAt && c.expiresAt < Date.now()) throw new ApiError("Instagram token expired - reconnect");
  const dayOld = Date.now() - c.obtainedAt > 86_400_000;
  if (dayOld && c.expiresAt && c.expiresAt - Date.now() < 30 * 86_400_000) {
    const t = await fetchJson<{ access_token: string; expires_in: number }>(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(c.accessToken)}`,
    );
    const next = { ...c, accessToken: t.access_token, expiresAt: Date.now() + t.expires_in * 1000, obtainedAt: Date.now() };
    saveConnection("instagram", next);
    return next;
  }
  return c;
}

export async function publish(
  file: string,
  plan: Plan,
  publicUrl: string | undefined,
  onStatus: (status: "uploading" | "processing", message: string) => void,
) {
  const c = await connection();
  const token = c.accessToken;
  const caption = `${plan.title}\n\n${plan.description}\n\n${plan.hashtags.join(" ")}`.slice(0, 2200);

  // 1. create a Reels container. With a public URL Instagram fetches the file itself,
  //    otherwise we push the bytes with a resumable upload.
  const params = new URLSearchParams({ media_type: "REELS", caption, share_to_feed: "true", access_token: token });
  if (publicUrl) params.set("video_url", publicUrl);
  else params.set("upload_type", "resumable");
  onStatus("uploading", "Creating Reels container");
  const container = await fetchJson<{ id: string; uri?: string }>(`${GRAPH}/${c.userId}/media`, {
    method: "POST",
    body: params,
  });

  if (!publicUrl) {
    const size = fs.statSync(file).size;
    onStatus("uploading", `Uploading ${(size / 1024 / 1024).toFixed(1)} MB`);
    await fetchJson(container.uri ?? `https://rupload.facebook.com/ig-api-upload/${V}/${container.id}`, {
      method: "POST",
      headers: { Authorization: `OAuth ${token}`, offset: "0", file_size: String(size) },
      body: fs.readFileSync(file),
    });
  }

  // 2. wait for Instagram to process the video
  onStatus("processing", "Instagram is processing the video");
  for (let i = 0; ; i++) {
    const st = await fetchJson<{ status_code: string; status?: string }>(
      `${GRAPH}/${container.id}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
    );
    if (st.status_code === "FINISHED") break;
    if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
      throw new ApiError(`Instagram processing failed: ${st.status ?? st.status_code}`);
    }
    if (i > 60) throw new ApiError("Instagram processing timed out");
    await sleep(5000);
  }

  // 3. publish
  const published = await fetchJson<{ id: string }>(`${GRAPH}/${c.userId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: container.id, access_token: token }),
  });
  let url: string | undefined;
  try {
    const m = await fetchJson<{ permalink?: string }>(
      `${GRAPH}/${published.id}?fields=permalink&access_token=${encodeURIComponent(token)}`,
    );
    url = m.permalink;
  } catch {
    /* permalink is optional */
  }
  return { id: published.id, url, message: "Published as Reel" };
}
