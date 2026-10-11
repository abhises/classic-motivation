import fs from "node:fs";
import { oauthRedirectUri } from "../paths";
import { getConnection, saveConnection, type Connection } from "../store";
import type { Plan } from "../types";
import { ApiError, fetchJson, form } from "./http";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

export const redirectUri = () => oauthRedirectUri("youtube");
export const configured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function authUrl(state: string) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export async function exchangeCode(code: string): Promise<Connection> {
  const { body, ...headers } = form({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
  const t = await fetchJson<TokenResponse>(TOKEN_URL, { method: "POST", headers, body });
  const ch = await fetchJson<{ items?: { id: string; snippet: { title: string } }[] }>(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${t.access_token}` } },
  );
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + t.expires_in * 1000,
    userId: ch.items?.[0]?.id,
    account: ch.items?.[0]?.snippet.title ?? "YouTube channel",
    obtainedAt: Date.now(),
  };
}

async function accessToken(): Promise<string> {
  const c = getConnection("youtube");
  if (!c) throw new ApiError("YouTube is not connected");
  if (c.expiresAt && c.expiresAt - 60_000 > Date.now()) return c.accessToken;
  if (!c.refreshToken) throw new ApiError("YouTube token expired - reconnect the account");
  const { body, ...headers } = form({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: c.refreshToken,
    grant_type: "refresh_token",
  });
  const t = await fetchJson<TokenResponse>(TOKEN_URL, { method: "POST", headers, body }).catch((e) => {
    if (!String(e?.message).includes("invalid_grant")) throw e;
    // Google OAuth apps in "Testing" status issue refresh tokens that die after 7 days.
    const days = ((Date.now() - c.obtainedAt) / 86_400_000).toFixed(1);
    throw new ApiError(
      `YouTube authorization expired or was revoked (connected ${days} days ago) - reconnect the account on /accounts. ` +
        "If this keeps happening every ~7 days, publish the Google OAuth consent screen (Testing apps' refresh tokens expire after 7 days).",
    );
  });
  saveConnection("youtube", { ...c, accessToken: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 });
  return t.access_token;
}

export async function publish(
  file: string,
  plan: Plan,
  opts: { privacy: string },
  onStatus: (status: "uploading" | "processing", message: string) => void,
) {
  const token = await accessToken();
  const size = fs.statSync(file).size;
  let title = plan.title.slice(0, 100);
  if (!/#shorts/i.test(title) && title.length + 8 <= 100) title += " #Shorts";
  const tags = plan.hashtags.map((h) => h.replace(/^#/, ""));

  onStatus("uploading", "Starting resumable upload");
  const init = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(size),
      },
      body: JSON.stringify({
        snippet: {
          title,
          description: `${plan.description}\n\n${plan.hashtags.join(" ")}`.slice(0, 5000),
          tags,
          categoryId: "22",
        },
        status: { privacyStatus: opts.privacy, selfDeclaredMadeForKids: false },
      }),
    },
  );
  const location = init.headers.get("location");
  if (!init.ok || !location) throw new ApiError(`YouTube upload init failed: ${init.status} ${await init.text()}`);

  onStatus("uploading", `Uploading ${(size / 1024 / 1024).toFixed(1)} MB`);
  const video = await fetchJson<{ id: string; status?: { privacyStatus?: string } }>(location, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(size) },
    body: fs.readFileSync(file),
  });
  return {
    id: video.id,
    url: `https://youtube.com/shorts/${video.id}`,
    message: `Uploaded (${video.status?.privacyStatus ?? opts.privacy})`,
  };
}
