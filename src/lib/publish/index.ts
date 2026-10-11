import { getPlan, setPublished } from "../library";
import { APP_URL, outputPath } from "../paths";
import { getSettings } from "../store";
import type { ConnectionStatus, Platform } from "../types";
import { getConnection } from "../store";
import * as instagram from "./instagram";
import * as tiktok from "./tiktok";
import * as youtube from "./youtube";

export const providers = { youtube, instagram, tiktok };

export function connectionStatus(p: Platform): ConnectionStatus {
  const c = getConnection(p);
  return {
    platform: p,
    configured: providers[p].configured(),
    connected: !!c,
    account: c?.account,
    redirectUri: providers[p].redirectUri(),
    expiresAt: c?.refreshExpiresAt
      ? new Date(c.refreshExpiresAt).toISOString()
      : c?.expiresAt && p === "instagram"
        ? new Date(c.expiresAt).toISOString()
        : undefined,
  };
}

const inFlight = new Set<string>();

/** Upload output/<slug>/final.mp4 to a platform, recording progress in output/<slug>/published.json. */
export async function publishVideo(slug: string, platform: Platform): Promise<void> {
  const key = `${slug}:${platform}`;
  if (inFlight.has(key)) throw new Error("Already publishing");
  const plan = getPlan(slug);
  if (!plan) throw new Error(`No plan.json for ${slug}`);
  const file = outputPath(slug, "final.mp4");
  const settings = getSettings();
  const onStatus = (status: "uploading" | "processing", message: string) =>
    setPublished(slug, platform, { status, message });

  inFlight.add(key);
  try {
    onStatus("uploading", "Starting");
    let result: { id: string; url?: string; message: string };
    if (platform === "youtube") {
      result = await youtube.publish(file, plan, { privacy: settings.youtubePrivacy }, onStatus);
    } else if (platform === "instagram") {
      // Instagram Login rejects resumable uploads, so give it a URL to fetch; an https APP_URL (tunnel) works
      const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || (APP_URL.startsWith("https://") ? APP_URL : undefined);
      const publicUrl = base ? `${base}/api/media/${encodeURIComponent(slug)}/final.mp4` : undefined;
      result = await instagram.publish(file, plan, publicUrl, onStatus);
    } else {
      result = await tiktok.publish(file, plan, { mode: settings.tiktokMode, privacy: settings.tiktokPrivacy }, onStatus);
    }
    setPublished(slug, platform, { status: "published", ...result });
  } catch (e) {
    setPublished(slug, platform, { status: "failed", message: e instanceof Error ? e.message : String(e) });
    throw e;
  } finally {
    inFlight.delete(key);
  }
}
