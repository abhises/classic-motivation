"use client";
import { useEffect, useRef, useState } from "react";
import { api, elapsed, media } from "@/lib/client";
import type { ConnectionStatus, Job } from "@/lib/types";
import { PublishButtons } from "./PublishButtons";

const STEPS = [
  { key: "script", label: "Script", desc: "Gemini writes hook, scenes & hashtags" },
  { key: "voice", label: "Voiceover", desc: "edge-tts narrates each scene" },
  { key: "footage", label: "Footage", desc: "Pexels clips cut to 1080×1920" },
  { key: "assemble", label: "Assemble", desc: "Captions, music & final encode" },
  { key: "publish", label: "Publish", desc: "Upload to your channels" },
] as const;

function progress(job: Job) {
  const n = job.scenes.length || 1;
  const voiced = job.scenes.filter((s) => s.voice).length;
  const clips = job.scenes.filter((s) => s.clip).length;
  switch (job.stage) {
    case "queued":
      return 0;
    case "script":
      return 5;
    case "voice":
      return 15 + (25 * voiced) / n;
    case "footage":
      return 40 + (40 * clips) / n;
    case "assemble":
      return 85;
    case "publish":
      return 95;
    case "done":
      return 100;
  }
}

export function JobView({ job, connections, onChange }: { job: Job; connections?: ConnectionStatus[]; onChange: () => void }) {
  const [, tick] = useState(0);
  const active = job.status === "running" || job.status === "queued";
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [active]);

  const steps = STEPS.filter((s) => s.key !== "publish" || job.autoPost.length || job.stage === "publish");
  const order = ["queued", ...steps.map((s) => s.key), "done"];
  const cur = order.indexOf(job.stage);
  const pct = job.status === "done" ? 100 : progress(job);
  const n = job.scenes.length;
  const voiced = job.scenes.filter((s) => s.voice).length;
  const clips = job.scenes.filter((s) => s.clip).length;
  const detail: Record<string, string> = {
    script: job.plan ? `“${job.plan.title}”` : "Writing…",
    voice: n ? `${voiced}/${n} lines` : "",
    footage: n ? `${clips}/${n} clips` : "",
    assemble: job.video ? `${job.duration}s video` : "",
    publish: job.autoPost.join(", "),
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <StatusPill status={job.status} />
            {job.source === "autopilot" && <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-300">autopilot</span>}
            <span>{elapsed(job.startedAt ?? job.createdAt, job.finishedAt)}</span>
          </div>
          <h2 className="mt-1 truncate text-xl font-semibold text-white">{job.plan?.title ?? job.topic}</h2>
          {job.plan && <p className="text-sm text-zinc-500">Topic: {job.topic}</p>}
        </div>
        {active && (
          <button
            onClick={() => api(`/api/jobs/${job.id}/cancel`).then(onChange)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
          >
            Cancel
          </button>
        )}
        {(job.status === "failed" || job.status === "cancelled") && (
          <button
            onClick={() => api(`/api/jobs/${job.id}/retry`).then(onChange)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
          >
            Retry
          </button>
        )}
      </div>

      {/* progress bar */}
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            job.status === "failed" ? "bg-rose-500" : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400"
          } ${active ? "animate-pulse" : ""}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>

      {/* pipeline stepper */}
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {steps.map((s) => {
          const idx = order.indexOf(s.key);
          const state =
            job.status === "done" || idx < cur ? "done" : idx === cur ? (job.status === "failed" ? "failed" : job.status === "cancelled" ? "idle" : "active") : "idle";
          return (
            <li
              key={s.key}
              className={`relative overflow-hidden rounded-xl border p-3 transition ${
                state === "active"
                  ? "border-fuchsia-500/50 bg-fuchsia-500/10"
                  : state === "done"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : state === "failed"
                      ? "border-rose-500/50 bg-rose-500/10"
                      : "border-white/5 bg-white/[0.02]"
              }`}
            >
              {state === "active" && <div className="shimmer pointer-events-none absolute inset-0" />}
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    state === "done"
                      ? "bg-emerald-500 text-black"
                      : state === "active"
                        ? "bg-fuchsia-500 text-white"
                        : state === "failed"
                          ? "bg-rose-500 text-white"
                          : "bg-white/10 text-zinc-500"
                  }`}
                >
                  {state === "done" ? "✓" : state === "failed" ? "!" : steps.indexOf(s) + 1}
                </span>
                <span className={`text-sm font-medium ${state === "idle" ? "text-zinc-500" : "text-white"}`}>{s.label}</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">{s.desc}</p>
              {state !== "idle" && detail[s.key] && <p className="mt-1 truncate text-[11px] text-zinc-300">{detail[s.key]}</p>}
            </li>
          );
        })}
      </ol>

      {job.status === "failed" && job.error && (
        <pre className="whitespace-pre-wrap rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{job.error}</pre>
      )}

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <PhonePreview job={job} />
          {job.outdir && job.video && (
            <PublishButtons slug={job.outdir} published={job.published ?? {}} connections={connections} onChange={onChange} />
          )}
        </div>
        <div className="min-w-0 space-y-4">
          <SceneBoard job={job} />
          <LogConsole lines={job.logs} />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Job["status"] }) {
  const cls = {
    queued: "bg-zinc-500/20 text-zinc-300",
    running: "bg-fuchsia-500/20 text-fuchsia-300",
    done: "bg-emerald-500/20 text-emerald-300",
    failed: "bg-rose-500/20 text-rose-300",
    cancelled: "bg-zinc-500/20 text-zinc-400",
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-medium ${cls}`}>
      {status === "running" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-400" />}
      {status}
    </span>
  );
}

function PhonePreview({ job }: { job: Job }) {
  const lastClip = [...job.scenes].map((s, i) => ({ ...s, i })).reverse().find((s) => s.clip);
  return (
    <div className="mx-auto w-full max-w-[260px] rounded-[2rem] border-4 border-zinc-800 bg-black p-1.5 shadow-2xl shadow-fuchsia-500/10">
      <div className="relative aspect-[9/16] overflow-hidden rounded-[1.6rem] bg-zinc-900">
        {job.video ? (
          <video key={job.video} src={media(job.video)} controls autoPlay muted loop playsInline className="h-full w-full object-cover" />
        ) : lastClip?.clip ? (
          <>
            <video key={lastClip.clip} src={media(lastClip.clip)} autoPlay muted loop playsInline className="h-full w-full object-cover" />
            <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 text-center text-lg font-black uppercase leading-tight text-white [text-shadow:0_2px_8px_#000,0_0_2px_#000]">
              {job.plan?.scenes[lastClip.i]?.text.split(" ").slice(0, 4).join(" ")}
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 p-3 text-[11px] text-zinc-300">
              Rendering scene {lastClip.i + 1}/{job.scenes.length}…
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
            {job.status === "running" || job.status === "queued" ? (
              <>
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-fuchsia-500" />
                <p className="text-xs text-zinc-400">{job.status === "queued" ? "Waiting in queue…" : job.plan ? "Recording voiceover…" : "Writing the script…"}</p>
                {job.plan && <p className="text-sm font-semibold text-white">{job.plan.title}</p>}
              </>
            ) : (
              <p className="text-xs text-zinc-500">No video</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SceneBoard({ job }: { job: Job }) {
  if (!job.plan) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-white/5 bg-white/[0.03]" />
        ))}
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-zinc-300">Storyboard</h3>
        <span className="text-xs text-zinc-500">{job.plan.hashtags.join(" ")}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {job.plan.scenes.map((scene, i) => {
          const p = job.scenes[i] ?? {};
          const working =
            job.status === "running" &&
            ((job.stage === "voice" && !p.voice && i === job.scenes.findIndex((s) => !s.voice)) ||
              (job.stage === "footage" && !p.clip && i === job.scenes.findIndex((s) => !s.clip)));
          return (
            <div
              key={i}
              className={`flex gap-3 rounded-xl border p-2.5 transition ${working ? "border-fuchsia-500/50 bg-fuchsia-500/5" : "border-white/5 bg-white/[0.03]"}`}
            >
              <div className="relative aspect-[9/16] w-16 shrink-0 overflow-hidden rounded-md bg-zinc-800">
                {p.clip ? (
                  <video src={media(p.clip)} autoPlay muted loop playsInline className="h-full w-full object-cover" />
                ) : (
                  <div className={`h-full w-full ${working ? "shimmer" : ""}`} />
                )}
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] font-bold text-white">{i + 1}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-3 text-xs leading-relaxed text-zinc-200">{scene.text}</p>
                <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                  {scene.search && <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-sky-300">🔎 {scene.search}</span>}
                  {p.voice ? (
                    <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-violet-300">🎙 {p.voice.toFixed(1)}s</span>
                  ) : null}
                  {p.clip && (
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">{p.stock ? "stock clip" : "color bg"}</span>
                  )}
                  {working && <span className="animate-pulse rounded bg-fuchsia-500/20 px-1.5 py-0.5 text-fuchsia-300">working…</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LogConsole({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLPreElement>(null);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length, open]);
  return (
    <div className="overflow-hidden rounded-xl border border-white/5 bg-black/60">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200">
        <span className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500/70" />
            <span className="h-2 w-2 rounded-full bg-amber-500/70" />
            <span className="h-2 w-2 rounded-full bg-emerald-500/70" />
          </span>
          Pipeline log
        </span>
        <span>{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <pre ref={ref} className="max-h-56 overflow-auto px-3 pb-3 font-mono text-[11px] leading-relaxed text-zinc-400">
          {lines.length ? lines.join("\n") : "…"}
        </pre>
      )}
    </div>
  );
}
