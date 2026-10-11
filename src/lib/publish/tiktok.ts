import { createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import { oauthRedirectUri } from "../paths";
import { getConnection, saveConnection, type Connection } from "../store";
import type { Plan } from "../types";
import { ApiError, fetchJson, form, sleep } from "./http";

const API = "https://open.tiktokapis.com/v2";
const MB = 1024 * 1024;

export const redirectUri = () => oauthRedirectUri("tiktok");
export const configured = () => !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);

// PKCE: the verifier is derived from the OAuth state, so the callback can rebuild it without storing anything.
const codeVerifier = (state: string) => createHmac("sha256", process.env.TIKTOK_CLIENT_SECRET!).update(state).digest("hex");

export function authUrl(state: string) {
  const q = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "user.info.basic,video.publish,video.upload",
    state,
    // TikTok expects the SHA256 challenge hex-encoded (not base64url like standard PKCE)
    code_challenge: createHash("sha256").update(codeVerifier(state)).digest("hex"),
    code_challenge_method: "S256",
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  open_id: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(data: Record<string, string>): Promise<TokenResponse> {
  const { body, ...headers } = form({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    client_secret: process.env.TIKTOK_CLIENT_SECRET!,
    ...data,
  });
  const t = await fetchJson<TokenResponse>(`${API}/oauth/token/`, { method: "POST", headers, body });
  if (t.error) throw new ApiError(`TikTok: ${t.error_description || t.error}`);
  return t;
}

function toConnection(t: TokenResponse, account?: string): Connection {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + t.expires_in * 1000,
    refreshExpiresAt: Date.now() + t.refresh_expires_in * 1000,
    userId: t.open_id,
    account,
    obtainedAt: Date.now(),
  };
}

export async function exchangeCode(code: string, state: string): Promise<Connection> {
  const t = await tokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code_verifier: codeVerifier(state),
  });
  let account = "TikTok account";
  try {
    const u = await fetchJson<{ data: { user: { display_name?: string } } }>(
      `${API}/user/info/?fields=open_id,display_name`,
      { headers: { Authorization: `Bearer ${t.access_token}` } },
    );
    account = u.data.user.display_name || account;
  } catch {
    /* name is cosmetic */
  }
  return toConnection(t, account);
}

async function accessToken(): Promise<string> {
  const c = getConnection("tiktok");
  if (!c) throw new ApiError("TikTok is not connected");
  if (c.expiresAt && c.expiresAt - 60_000 > Date.now()) return c.accessToken;
  if (!c.refreshToken) throw new ApiError("TikTok token expired - reconnect");
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: c.refreshToken });
  saveConnection("tiktok", toConnection(t, c.account));
  return t.access_token;
}

type TikTokResponse<T> = { data: T; error: { code: string; message: string } };

async function api<T>(token: string, pathname: string, body: unknown): Promise<T> {
  const r = await fetchJson<TikTokResponse<T>>(`${API}${pathname}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body),
  });
  if (r.error && r.error.code !== "ok") throw new ApiError(`TikTok ${r.error.code}: ${r.error.message}`);
  return r.data;
}

export async function publish(
  file: string,
  plan: Plan,
  opts: { mode: "direct" | "inbox"; privacy: string },
  onStatus: (status: "uploading" | "processing", message: string) => void,
) {
  const token = await accessToken();
  const size = fs.statSync(file).size;
  // Chunk rules: one chunk if <= 64MB, otherwise 10MB chunks with the remainder folded into the last one.
  const chunkSize = size <= 64 * MB ? size : 10 * MB;
  const chunks = Math.max(1, Math.floor(size / chunkSize));
  const source_info = { source: "FILE_UPLOAD", video_size: size, chunk_size: chunkSize, total_chunk_count: chunks };

  let init: { publish_id: string; upload_url: string };
  let username: string | undefined;
  if (opts.mode === "inbox") {
    onStatus("uploading", "Sending to TikTok inbox (drafts)");
    init = await api(token, "/post/publish/inbox/video/init/", { source_info });
  } else {
    const creator = await api<{ privacy_level_options: string[]; creator_username?: string }>(
      token,
      "/post/publish/creator_info/query/",
      {},
    );
    if (!creator.privacy_level_options.includes(opts.privacy)) {
      throw new ApiError(
        `TikTok privacy "${opts.privacy}" not allowed for this account/app. Allowed: ${creator.privacy_level_options.join(", ")}. ` +
          "Unaudited apps can only post SELF_ONLY (private) - change it in Accounts, or use Inbox mode.",
      );
    }
    username = creator.creator_username;
    onStatus("uploading", "Initialising direct post");
    const caption = `${plan.title} ${plan.description} ${plan.hashtags.join(" ")}`.slice(0, 2200);
    init = await api(token, "/post/publish/video/init/", {
      post_info: { title: caption, privacy_level: opts.privacy, disable_comment: false, disable_duet: false, disable_stitch: false },
      source_info,
    });
  }

  const fd = fs.openSync(file, "r");
  try {
    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize;
      const end = i === chunks - 1 ? size : start + chunkSize;
      const buf = Buffer.alloc(end - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      onStatus("uploading", `Uploading chunk ${i + 1}/${chunks}`);
      const res = await fetch(init.upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(buf.length),
          "Content-Range": `bytes ${start}-${end - 1}/${size}`,
        },
        body: buf,
      });
      if (!res.ok) throw new ApiError(`TikTok chunk upload failed: ${res.status} ${await res.text()}`);
    }
  } finally {
    fs.closeSync(fd);
  }

  onStatus("processing", "TikTok is processing the video");
  for (let i = 0; i < 60; i++) {
    const st = await api<{ status: string; fail_reason?: string; publicaly_available_post_id?: (string | number)[] }>(
      token,
      "/post/publish/status/fetch/",
      { publish_id: init.publish_id },
    );
    if (st.status === "FAILED") throw new ApiError(`TikTok rejected the video: ${st.fail_reason}`);
    if (st.status === "SEND_TO_USER_INBOX") {
      return { id: init.publish_id, message: "In your TikTok inbox - open the app to finish posting" };
    }
    if (st.status === "PUBLISH_COMPLETE") {
      const postId = st.publicaly_available_post_id?.[0];
      return {
        id: String(postId ?? init.publish_id),
        url: postId && username ? `https://www.tiktok.com/@${username}/video/${postId}` : undefined,
        message: opts.privacy === "SELF_ONLY" ? "Posted (private - only you can see it)" : "Posted",
      };
    }
    await sleep(5000);
  }
  return { id: init.publish_id, message: "Upload accepted; TikTok is still processing" };
}
