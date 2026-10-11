import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { getPublished } from "./library";
import { DATA_DIR, outputPath, PYTHON_BIN, SHORTS_DIR } from "./paths";
import { publishVideo } from "./publish";
import { getSettings, readJson, writeJson } from "./store";
import type { Job, Platform } from "./types";

const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
const MAX_JOBS = 100;
const MAX_LOG_LINES = 400;

interface State {
  jobs: Job[];
  running?: { id: string; proc: ChildProcess };
}

// Survive hot reloads in dev and share state between route handlers and instrumentation.
const g = globalThis as unknown as { __studioJobs?: State };
const state: State = (g.__studioJobs ??= init());

function init(): State {
  const jobs = readJson<Job[]>(JOBS_FILE, []);
  for (const j of jobs) {
    if (j.status === "running" || j.status === "queued") {
      j.status = "failed";
      j.error = "Studio server restarted while this job was in progress";
    }
  }
  return { jobs };
}

function persist() {
  writeJson(JOBS_FILE, state.jobs.slice(0, MAX_JOBS));
}

function log(job: Job, line: string) {
  job.logs.push(line);
  if (job.logs.length > MAX_LOG_LINES) job.logs.splice(0, job.logs.length - MAX_LOG_LINES);
}

function withPublished(job: Job): Job {
  return job.outdir ? { ...job, published: getPublished(job.outdir) } : job;
}

export function listJobs(): Job[] {
  return state.jobs.map((j) => withPublished({ ...j, logs: [] }));
}

export function getJob(id: string): Job | undefined {
  const j = state.jobs.find((x) => x.id === id);
  return j && withPublished(j);
}

export function hasActiveJob(source?: Job["source"]) {
  return state.jobs.some((j) => (j.status === "queued" || j.status === "running") && (!source || j.source === source));
}

export function createJob(input: { topic: string; voice?: string; autoPost?: Platform[]; source?: Job["source"] }): Job {
  const job: Job = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    topic: input.topic.trim(),
    voice: input.voice,
    source: input.source ?? "manual",
    createdAt: new Date().toISOString(),
    status: "queued",
    stage: "queued",
    scenes: [],
    logs: [],
    autoPost: input.autoPost ?? [],
  };
  state.jobs.unshift(job);
  persist();
  void pump();
  return job;
}

export function cancelJob(id: string): boolean {
  const job = state.jobs.find((j) => j.id === id);
  if (!job || (job.status !== "queued" && job.status !== "running")) return false;
  if (state.running?.id === id) state.running.proc.kill("SIGTERM");
  job.status = "cancelled";
  job.finishedAt = new Date().toISOString();
  persist();
  return true;
}

/** Requeue a failed/cancelled job. If its script was already written, the re-run reuses that plan.json. */
export function retryJob(id: string): boolean {
  const job = state.jobs.find((j) => j.id === id);
  if (!job || (job.status !== "failed" && job.status !== "cancelled")) return false;
  job.status = "queued";
  job.stage = "queued";
  job.scenes = job.scenes.map(() => ({}));
  job.logs = [];
  job.error = undefined;
  job.video = undefined;
  job.duration = undefined;
  job.startedAt = undefined;
  job.finishedAt = undefined;
  persist();
  void pump();
  return true;
}

/** Run queued jobs one at a time (oldest first). */
async function pump() {
  if (state.running) return;
  const job = [...state.jobs].reverse().find((j) => j.status === "queued");
  if (!job) return;
  try {
    await runJob(job);
  } catch (e) {
    job.status = "failed";
    job.error = e instanceof Error ? e.message : String(e);
  } finally {
    state.running = undefined;
    job.finishedAt ??= new Date().toISOString();
    persist();
    void pump();
  }
}

function handleEvent(job: Job, ev: Record<string, unknown>) {
  switch (ev.event) {
    case "stage":
      job.stage = ev.stage as Job["stage"];
      break;
    case "plan":
      job.outdir = ev.outdir as string;
      job.plan = ev.plan as Job["plan"];
      job.scenes = (job.plan?.scenes ?? []).map(() => ({}));
      break;
    case "voice":
      job.scenes[ev.index as number] = { ...job.scenes[ev.index as number], voice: ev.duration as number };
      break;
    case "clip":
      job.scenes[ev.index as number] = {
        ...job.scenes[ev.index as number],
        clip: ev.file as string,
        stock: ev.stock as boolean,
      };
      break;
    case "done":
      job.outdir = ev.outdir as string;
      job.video = ev.file as string;
      job.duration = ev.duration as number;
      break;
  }
}

async function runJob(job: Job) {
  if (!fs.existsSync(PYTHON_BIN)) throw new Error(`Python not found at ${PYTHON_BIN} - set PYTHON_BIN or SHORTS_DIR`);
  // a retried job that already has a script re-renders it instead of asking Gemini again
  const planFile = job.outdir ? outputPath(job.outdir, "plan.json") : undefined;
  const reusePlan = !!planFile && fs.existsSync(planFile);
  job.status = "running";
  job.stage = reusePlan ? "voice" : "script";
  job.startedAt = new Date().toISOString();
  persist();

  const voice = job.voice || getSettings().voice;
  const input = reusePlan ? ["--plan", planFile] : [job.topic];
  const proc = spawn(PYTHON_BIN, ["-u", "make_short.py", ...input, "--voice", voice], {
    cwd: SHORTS_DIR,
    env: { ...process.env, SHORTS_EVENTS: "1", PYTHONUNBUFFERED: "1" },
  });
  state.running = { id: job.id, proc };

  readline.createInterface({ input: proc.stdout }).on("line", (line) => {
    if (line.startsWith("@@EVENT ")) {
      try {
        handleEvent(job, JSON.parse(line.slice(8)));
        persist();
      } catch {
        log(job, line);
      }
    } else {
      log(job, line);
    }
  });
  readline.createInterface({ input: proc.stderr }).on("line", (line) => log(job, line));

  const code = await new Promise<number | null>((resolve) => {
    proc.on("close", resolve);
    proc.on("error", (e) => {
      log(job, String(e));
      resolve(-1);
    });
  });
  // status may have been flipped to "cancelled" by cancelJob while we awaited
  if ((job.status as Job["status"]) === "cancelled") return;
  if (code !== 0 || !job.video || !job.outdir) {
    job.status = "failed";
    job.error = job.logs.filter((l) => l.trim()).slice(-3).join("\n") || `Generator exited with code ${code}`;
    return;
  }

  if (job.autoPost.length) {
    job.stage = "publish";
    persist();
    for (const platform of job.autoPost) {
      // a retried job may already have been posted here - never upload the same video twice
      if (getPublished(job.outdir)[platform]?.status === "published") {
        log(job, `Already published to ${platform}, skipping`);
        continue;
      }
      log(job, `Publishing to ${platform}...`);
      try {
        await publishVideo(job.outdir, platform);
        log(job, `  ${platform}: ${getPublished(job.outdir)[platform]?.message ?? "done"}`);
      } catch (e) {
        log(job, `  ${platform} failed: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
  job.stage = "done";
  job.status = "done";
  job.finishedAt = new Date().toISOString();
}
