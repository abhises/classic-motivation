"use client";
import { useState } from "react";
import { JobView } from "@/components/JobView";
import { PlatformIcon } from "@/components/PlatformIcon";
import { api, timeAgo, usePoll, VOICES } from "@/lib/client";
import { PLATFORMS, PLATFORM_LABEL, type ConnectionStatus, type Job, type Platform, type Settings } from "@/lib/types";

export default function StudioPage() {
  const jobs = usePoll<Job[]>("/api/jobs", 2000);
  const connections = usePoll<ConnectionStatus[]>("/api/connections", 15000);
  const settings = usePoll<Settings>("/api/settings", 60000);
  const [selected, setSelected] = useState<string>();
  const selectedId = selected ?? jobs.data?.find((j) => j.status === "running")?.id ?? jobs.data?.[0]?.id;
  const job = usePoll<Job>(selectedId ? `/api/jobs/${selectedId}` : null, 1000);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-6">
        <CreateForm
          connections={connections.data}
          defaultVoice={settings.data?.voice}
          onCreated={(j) => {
            setSelected(j.id);
            void jobs.refresh();
          }}
        />
        <section className="rounded-2xl border border-white/5 bg-zinc-900/50 p-5">
          {job.data && job.data.id === selectedId ? (
            <JobView
              job={job.data}
              connections={connections.data}
              onChange={() => {
                void job.refresh();
                void jobs.refresh();
              }}
            />
          ) : (
            <div className="py-16 text-center text-sm text-zinc-500">
              {jobs.data && !jobs.data.length ? "No videos yet — type a topic above and hit Generate." : "Loading…"}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-2">
        <h3 className="px-1 text-xs font-medium uppercase tracking-wider text-zinc-500">Activity</h3>
        {jobs.data?.map((j) => (
          <button
            key={j.id}
            onClick={() => setSelected(j.id)}
            className={`w-full rounded-xl border p-3 text-left transition ${
              j.id === selectedId ? "border-fuchsia-500/40 bg-fuchsia-500/5" : "border-white/5 bg-zinc-900/40 hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  j.status === "running"
                    ? "animate-pulse bg-fuchsia-400"
                    : j.status === "done"
                      ? "bg-emerald-400"
                      : j.status === "failed"
                        ? "bg-rose-400"
                        : "bg-zinc-500"
                }`}
              />
              <span className="truncate text-sm text-zinc-200">{j.plan?.title ?? j.topic}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 pl-4 text-[11px] text-zinc-500">
              <span>{j.status === "running" ? j.stage : j.status}</span>
              <span>·</span>
              <span>{timeAgo(j.createdAt)}</span>
              <span className="ml-auto flex gap-1">
                {PLATFORMS.filter((p) => j.published?.[p]).map((p) => (
                  <span key={p} className={j.published?.[p]?.status === "failed" ? "opacity-30 grayscale" : ""}>
                    <PlatformIcon platform={p} className="h-3.5 w-3.5" />
                  </span>
                ))}
              </span>
            </div>
          </button>
        ))}
      </aside>
    </div>
  );
}

function CreateForm({
  connections,
  defaultVoice,
  onCreated,
}: {
  connections?: ConnectionStatus[];
  defaultVoice?: string;
  onCreated: (j: Job) => void;
}) {
  const [topic, setTopic] = useState("");
  const [voiceChoice, setVoice] = useState<string>();
  const voice = voiceChoice ?? defaultVoice ?? VOICES[0].id;
  const [autoPost, setAutoPost] = useState<Platform[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setBusy(true);
    setErr(undefined);
    try {
      onCreated(await api<Job>("/api/jobs", "POST", { topic, voice, autoPost }));
      setTopic("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/5 bg-gradient-to-br from-violet-500/10 via-zinc-900/60 to-amber-500/5 p-5">
      <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">New short</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. 5 wild facts about black holes"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-fuchsia-500/60 focus:outline-none"
        />
        <button
          disabled={busy || !topic.trim()}
          className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 font-semibold text-white shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Starting…" : "Generate"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-2 text-zinc-400">
          Voice
          <select value={voice} onChange={(e) => setVoice(e.target.value)} className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-zinc-200">
            {VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <span className="text-zinc-400">Auto-post when done:</span>
        {PLATFORMS.map((p) => {
          const conn = connections?.find((c) => c.platform === p);
          return (
            <label key={p} className={`flex items-center gap-1.5 ${conn?.connected ? "text-zinc-200" : "text-zinc-600"}`} title={conn?.connected ? conn.account : "Connect in Accounts first"}>
              <input
                type="checkbox"
                disabled={!conn?.connected}
                checked={autoPost.includes(p)}
                onChange={(e) => setAutoPost(e.target.checked ? [...autoPost, p] : autoPost.filter((x) => x !== p))}
                className="accent-fuchsia-500"
              />
              <PlatformIcon platform={p} />
              <span className="hidden md:inline">{PLATFORM_LABEL[p]}</span>
            </label>
          );
        })}
      </div>
      {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}
    </form>
  );
}
