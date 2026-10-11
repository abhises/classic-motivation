import fs from "node:fs";
import { outputPath, OUTPUT_DIR } from "./paths";
import { readJson, writeJson } from "./store";
import type { Plan, Platform, PublishMap, PublishResult, VideoEntry } from "./types";

export function getPublished(slug: string): PublishMap {
  return readJson<PublishMap>(outputPath(slug, "published.json"), {});
}

export function setPublished(slug: string, platform: Platform, result: Omit<PublishResult, "at">) {
  const all = getPublished(slug);
  all[platform] = { ...result, at: new Date().toISOString() };
  writeJson(outputPath(slug, "published.json"), all);
}

export function getPlan(slug: string): Plan | undefined {
  return readJson<Plan | undefined>(outputPath(slug, "plan.json"), undefined);
}

export function getCaption(slug: string): string {
  try {
    return fs.readFileSync(outputPath(slug, "post.txt"), "utf8").trim();
  } catch {
    return "";
  }
}

export function getVideo(slug: string): VideoEntry | undefined {
  const file = outputPath(slug, "final.mp4");
  if (!fs.existsSync(file)) return undefined;
  const st = fs.statSync(file);
  const plan = getPlan(slug);
  return {
    slug,
    title: plan?.title || slug,
    caption: getCaption(slug),
    plan,
    video: `${slug}/final.mp4`,
    createdAt: st.mtime.toISOString(),
    sizeMB: Math.round((st.size / 1024 / 1024) * 10) / 10,
    published: getPublished(slug),
  };
}

export function listVideos(): VideoEntry[] {
  if (!fs.existsSync(OUTPUT_DIR)) return [];
  return fs
    .readdirSync(OUTPUT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => getVideo(d.name))
    .filter((v): v is VideoEntry => !!v)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
