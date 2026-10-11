"use client";
import { useState } from "react";
import { PlatformIcon } from "@/components/PlatformIcon";
import { PublishButtons } from "@/components/PublishButtons";
import { media, timeAgo, usePoll } from "@/lib/client";
import { PLATFORMS, type ConnectionStatus, type VideoEntry } from "@/lib/types";

export default function LibraryPage() {
  const videos = usePoll<VideoEntry[]>("/api/videos", 3000);
  const connections = usePoll<ConnectionStatus[]>("/api/connections", 15000);
  const [open, setOpen] = useState<string>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Library</h1>
        <p className="text-sm text-zinc-500">Every rendered short. Post or re-post to any connected platform.</p>
      </div>
      {videos.data && !videos.data.length && <p className="text-sm text-zinc-500">No videos yet.</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {videos.data?.map((v) => (
          <div key={v.slug} className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/50">
            <video src={media(v.video)} controls preload="metadata" playsInline className="aspect-[9/16] max-h-[420px] w-full bg-black object-contain" />
            <div className="space-y-3 p-4">
              <div>
                <h3 className="font-medium leading-snug text-white">{v.title}</h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                  <span>{timeAgo(v.createdAt)}</span>
                  <span>·</span>
                  <span>{v.sizeMB} MB</span>
                  <span className="ml-auto flex gap-1">
                    {PLATFORMS.filter((p) => v.published[p]?.status === "published").map((p) => (
                      <PlatformIcon key={p} platform={p} className="h-4 w-4" />
                    ))}
                  </span>
                </div>
              </div>
              <button onClick={() => setOpen(open === v.slug ? undefined : v.slug)} className="text-xs text-zinc-400 hover:text-zinc-200">
                {open === v.slug ? "Hide caption ▴" : "Show caption ▾"}
              </button>
              {open === v.slug && (
                <div className="space-y-2">
                  <pre className="whitespace-pre-wrap rounded-lg bg-black/40 p-3 font-sans text-xs text-zinc-300">{v.caption}</pre>
                  <button onClick={() => navigator.clipboard.writeText(v.caption)} className="text-xs text-sky-400 hover:underline">
                    Copy caption
                  </button>
                </div>
              )}
              <PublishButtons slug={v.slug} published={v.published} connections={connections.data} onChange={videos.refresh} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
