"use client";
import { useState } from "react";
import { PlatformIcon } from "@/components/PlatformIcon";
import { api, usePoll } from "@/lib/client";
import { PLATFORMS, PLATFORM_LABEL, type ConnectionStatus, type Platform, type Settings } from "@/lib/types";

type SettingsResponse = Settings & { nextRunAt?: string };
type Topics = { text: string; pending: string[]; done: string[] };

export default function AutopilotPage() {
  const settings = usePoll<SettingsResponse>("/api/settings", 5000);
  const connections = usePoll<ConnectionStatus[]>("/api/connections", 15000);
  const topics = usePoll<Topics>("/api/topics", 10000);
  const [draft, setDraft] = useState<string>();
  const [msg, setMsg] = useState<string>();
  const ap = settings.data?.autopilot;

  async function update(patch: Partial<Settings["autopilot"]>) {
    await api("/api/settings", "PUT", { autopilot: patch });
    void settings.refresh();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Autopilot</h1>
        <p className="text-sm text-zinc-500">
          Pulls the next topic from your queue on a schedule, generates the short and posts it automatically.
        </p>
      </div>

      <section className="rounded-2xl border border-white/5 bg-zinc-900/50 p-5">
        {!ap ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  role="switch"
                  aria-checked={ap.enabled}
                  onClick={() => update({ enabled: !ap.enabled })}
                  className={`relative h-7 w-12 rounded-full transition ${ap.enabled ? "bg-emerald-500" : "bg-zinc-700"}`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${ap.enabled ? "left-6" : "left-1"}`} />
                </button>
                <div>
                  <div className="font-medium text-white">{ap.enabled ? "Autopilot is ON" : "Autopilot is off"}</div>
                  <div className="text-xs text-zinc-500">
                    {ap.enabled && settings.data?.nextRunAt
                      ? `Next video: ${new Date(settings.data.nextRunAt).toLocaleString()}`
                      : "Turn on to post automatically"}
                  </div>
                </div>
              </div>
              <button
                onClick={async () => {
                  const r = await api<{ message?: string }>("/api/autopilot/run");
                  setMsg(r.message);
                  void settings.refresh();
                  void topics.refresh();
                }}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
              >
                Run once now
              </button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm text-zinc-400">
                Post a new video every
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={0.25}
                    step={0.25}
                    defaultValue={ap.intervalHours}
                    onBlur={(e) => update({ intervalHours: Number(e.target.value) })}
                    className="w-24 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white"
                  />
                  <span>hours</span>
                </div>
              </label>
              <div className="text-sm text-zinc-400">
                Post to
                <div className="mt-2 flex flex-wrap gap-3">
                  {PLATFORMS.map((p) => {
                    const c = connections.data?.find((x) => x.platform === p);
                    return (
                      <label key={p} className={`flex items-center gap-1.5 ${c?.connected ? "text-zinc-200" : "text-zinc-600"}`}>
                        <input
                          type="checkbox"
                          className="accent-fuchsia-500"
                          disabled={!c?.connected}
                          checked={ap.platforms.includes(p)}
                          onChange={(e) =>
                            update({ platforms: e.target.checked ? [...ap.platforms, p] : ap.platforms.filter((x: Platform) => x !== p) })
                          }
                        />
                        <PlatformIcon platform={p} />
                        {PLATFORM_LABEL[p]}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            {(msg || ap.lastMessage) && (
              <p className="rounded-lg bg-black/30 px-3 py-2 text-xs text-zinc-400">
                {msg || ap.lastMessage}
                {ap.lastRunAt && <span className="text-zinc-600"> · {new Date(ap.lastRunAt).toLocaleString()}</span>}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-5 md:grid-cols-[1fr_260px]">
        <div className="rounded-2xl border border-white/5 bg-zinc-900/50 p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium text-white">Topic queue</h2>
            <span className="text-xs text-zinc-500">{topics.data?.pending.length ?? 0} waiting</span>
          </div>
          <p className="mb-3 text-xs text-zinc-500">One topic per line. Lines starting with # are ignored. Saved to shorts-maker/topics.txt.</p>
          <textarea
            value={draft ?? topics.data?.text ?? ""}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            className="w-full rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-sm text-zinc-200 focus:border-fuchsia-500/60 focus:outline-none"
          />
          <button
            onClick={async () => {
              const t = await api<Topics>("/api/topics", "PUT", { text: draft ?? topics.data?.text ?? "" });
              setDraft(t.text);
              void topics.refresh();
            }}
            className="mt-3 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            Save queue
          </button>
        </div>
        <div className="rounded-2xl border border-white/5 bg-zinc-900/50 p-5">
          <h2 className="mb-3 font-medium text-white">Already used</h2>
          <ul className="space-y-2 text-xs text-zinc-500">
            {topics.data?.done.length ? (
              topics.data.done.map((l, i) => {
                const [at, t] = l.split("\t");
                return (
                  <li key={i}>
                    <div className="text-zinc-300">{t}</div>
                    <div>{new Date(at).toLocaleString()}</div>
                  </li>
                );
              })
            ) : (
              <li>Nothing yet</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
