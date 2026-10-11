import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths";
import type { Platform, Settings } from "./types";

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

// ---------- settings ----------

const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export const DEFAULT_SETTINGS: Settings = {
  voice: "en-US-AndrewNeural",
  youtubePrivacy: "public",
  tiktokMode: "direct",
  tiktokPrivacy: "SELF_ONLY",
  autopilot: { enabled: false, intervalHours: 24, platforms: [] },
};

export function getSettings(): Settings {
  const s = readJson<Partial<Settings>>(SETTINGS_FILE, {});
  return { ...DEFAULT_SETTINGS, ...s, autopilot: { ...DEFAULT_SETTINGS.autopilot, ...s.autopilot } };
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const cur = getSettings();
  const next: Settings = {
    ...cur,
    ...patch,
    autopilot: { ...cur.autopilot, ...patch.autopilot },
  };
  writeJson(SETTINGS_FILE, next);
  return next;
}

// ---------- platform tokens ----------

const CONNECTIONS_FILE = path.join(DATA_DIR, "connections.json");

export interface Connection {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // ms epoch
  refreshExpiresAt?: number;
  userId?: string;
  account?: string;
  obtainedAt: number;
}

export function getConnection(p: Platform): Connection | undefined {
  return readJson<Partial<Record<Platform, Connection>>>(CONNECTIONS_FILE, {})[p];
}

export function saveConnection(p: Platform, c: Connection | undefined) {
  const all = readJson<Partial<Record<Platform, Connection>>>(CONNECTIONS_FILE, {});
  if (c) all[p] = c;
  else delete all[p];
  writeJson(CONNECTIONS_FILE, all);
}
