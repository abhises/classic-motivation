export const PLATFORMS = ["youtube", "instagram", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube Shorts",
  instagram: "Instagram Reels",
  tiktok: "TikTok",
};

export interface Scene {
  text: string;
  search?: string;
}

export interface Plan {
  title: string;
  description: string;
  hashtags: string[];
  scenes: Scene[];
  topic?: string;
}

export type Stage = "queued" | "script" | "voice" | "footage" | "assemble" | "publish" | "done";
export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface SceneProgress {
  voice?: number; // seconds
  clip?: string; // path relative to output dir
  stock?: boolean;
}

export interface PublishResult {
  status: "uploading" | "processing" | "published" | "failed";
  message?: string;
  url?: string;
  id?: string;
  at: string;
}

export type PublishMap = Partial<Record<Platform, PublishResult>>;

export interface Job {
  id: string;
  topic: string;
  voice?: string;
  source: "manual" | "autopilot";
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  status: JobStatus;
  stage: Stage;
  outdir?: string;
  plan?: Plan;
  scenes: SceneProgress[];
  video?: string;
  duration?: number;
  logs: string[];
  error?: string;
  autoPost: Platform[];
  published?: PublishMap; // filled in from output/<slug>/published.json when served
}

export interface VideoEntry {
  slug: string;
  title: string;
  caption: string;
  plan?: Plan;
  video: string;
  createdAt: string;
  sizeMB: number;
  published: PublishMap;
}

export interface Settings {
  voice: string;
  youtubePrivacy: "public" | "unlisted" | "private";
  tiktokMode: "direct" | "inbox";
  tiktokPrivacy: "SELF_ONLY" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "PUBLIC_TO_EVERYONE";
  autopilot: {
    enabled: boolean;
    intervalHours: number;
    platforms: Platform[];
    lastRunAt?: string;
    lastMessage?: string;
  };
}

export interface ConnectionStatus {
  platform: Platform;
  configured: boolean; // app credentials present in env
  connected: boolean;
  account?: string;
  redirectUri: string;
  expiresAt?: string;
}
