import { createJob, hasActiveJob } from "./jobs";
import { getSettings, saveSettings } from "./store";
import { popTopic } from "./topics";
import type { Job } from "./types";

const TICK_MS = 60_000;

export function nextRunAt(): string | undefined {
  const { autopilot } = getSettings();
  if (!autopilot.enabled) return undefined;
  const last = autopilot.lastRunAt ? Date.parse(autopilot.lastRunAt) : 0;
  return new Date(Math.max(Date.now(), last + autopilot.intervalHours * 3_600_000)).toISOString();
}

/** Take the next topic from topics.txt and start a job that auto-posts to the autopilot platforms. */
export function runAutopilotOnce(): Job | undefined {
  const { autopilot } = getSettings();
  const topic = popTopic();
  const now = new Date().toISOString();
  if (!topic) {
    saveSettings({ autopilot: { ...autopilot, lastRunAt: now, lastMessage: "Topic queue is empty - add topics to keep posting" } });
    return undefined;
  }
  const job = createJob({ topic, autoPost: autopilot.platforms, source: "autopilot" });
  saveSettings({ autopilot: { ...autopilot, lastRunAt: now, lastMessage: `Started "${topic}"` } });
  return job;
}

function tick() {
  const { autopilot } = getSettings();
  if (!autopilot.enabled || hasActiveJob("autopilot")) return;
  const due = !autopilot.lastRunAt || Date.now() - Date.parse(autopilot.lastRunAt) >= autopilot.intervalHours * 3_600_000;
  if (due) runAutopilotOnce();
}

export function startAutopilot() {
  const g = globalThis as unknown as { __studioAutopilot?: NodeJS.Timeout };
  if (g.__studioAutopilot) return;
  g.__studioAutopilot = setInterval(() => {
    try {
      tick();
    } catch (e) {
      console.error("[autopilot]", e);
    }
  }, TICK_MS);
  console.log("[autopilot] scheduler started");
}
