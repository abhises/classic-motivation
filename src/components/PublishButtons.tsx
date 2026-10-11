"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";
import { PLATFORMS, PLATFORM_LABEL, type ConnectionStatus, type PublishMap } from "@/lib/types";
import { PlatformIcon } from "./PlatformIcon";

export function PublishButtons({
  slug,
  published,
  connections,
  onChange,
}: {
  slug: string;
  published: PublishMap;
  connections?: ConnectionStatus[];
  onChange?: () => void;
}) {
  const [err, setErr] = useState<string>();
  return (
    <div className="space-y-2">
      {PLATFORMS.map((p) => {
        const r = published[p];
        const conn = connections?.find((c) => c.platform === p);
        const busy = r?.status === "uploading" || r?.status === "processing";
        return (
          <div key={p} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
            <PlatformIcon platform={p} className="h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-zinc-200">{PLATFORM_LABEL[p]}</div>
              <div
                className={`truncate text-[11px] ${
                  r?.status === "failed" ? "text-rose-400" : r?.status === "published" ? "text-emerald-400" : "text-zinc-500"
                }`}
                title={r?.message}
              >
                {r ? r.message || r.status : conn?.connected ? `Ready · ${conn.account ?? ""}` : "Not connected"}
              </div>
            </div>
            {r?.url && (
              <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline">
                View
              </a>
            )}
            {conn && !conn.connected ? (
              <Link href="/accounts" className="rounded-md bg-white/5 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/10">
                Connect
              </Link>
            ) : (
              <button
                disabled={busy}
                onClick={async () => {
                  setErr(undefined);
                  try {
                    await api(`/api/videos/${encodeURIComponent(slug)}/publish`, "POST", { platform: p });
                    onChange?.();
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : String(e));
                  }
                }}
                className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50"
              >
                {busy ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
                    {r?.status}
                  </span>
                ) : r?.status === "published" ? (
                  "Post again"
                ) : r?.status === "failed" ? (
                  "Retry"
                ) : (
                  "Post"
                )}
              </button>
            )}
          </div>
        );
      })}
      {err && <p className="text-xs text-rose-400">{err}</p>}
    </div>
  );
}
