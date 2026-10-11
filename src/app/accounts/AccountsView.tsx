"use client";
import { PlatformIcon } from "@/components/PlatformIcon";
import { api, usePoll, VOICES } from "@/lib/client";
import { PLATFORM_LABEL, type ConnectionStatus, type Platform, type Settings } from "@/lib/types";

const SETUP: Record<Platform, { env: string[]; steps: string[] }> = {
  youtube: {
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    steps: [
      "Google Cloud Console → create a project → enable “YouTube Data API v3”.",
      "OAuth consent screen: External, add yourself as a test user.",
      "Credentials → OAuth client ID → Web application → add the redirect URI below.",
    ],
  },
  instagram: {
    env: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"],
    steps: [
      "Your Instagram must be a Business or Creator account.",
      "developers.facebook.com → Create app → add “Instagram” product → API setup with Instagram login.",
      "Use the Instagram app ID/secret and add the redirect URI below under Business login settings.",
    ],
  },
  tiktok: {
    env: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    steps: [
      "developers.tiktok.com → Manage apps → create app → add Login Kit + Content Posting API (enable Direct Post).",
      "Scopes: user.info.basic, video.publish, video.upload. Add the redirect URI below (TikTok needs https — use a tunnel).",
      "Until TikTok audits your app, direct posts are private (SELF_ONLY). Use Inbox mode to post publicly from the app.",
    ],
  },
};

export function AccountsView({ flash }: { flash?: { platform: string; msg: string } }) {
  const conns = usePoll<ConnectionStatus[]>("/api/connections", 5000);
  const settings = usePoll<Settings>("/api/settings", 30000);
  const save = async (patch: Partial<Settings>) => {
    await api("/api/settings", "PUT", patch);
    void settings.refresh();
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Accounts</h1>
        <p className="text-sm text-zinc-500">Connect the channels you want to post to. Tokens are stored locally in studio/data/.</p>
      </div>
      {flash && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            flash.msg === "connected" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          {flash.msg === "connected" ? `${PLATFORM_LABEL[flash.platform as Platform] ?? flash.platform} connected ✓` : flash.msg}
        </div>
      )}

      <div className="space-y-4">
        {conns.data?.map((c) => (
          <section key={c.platform} className="rounded-2xl border border-white/5 bg-zinc-900/50 p-5">
            <div className="flex flex-wrap items-center gap-4">
              <PlatformIcon platform={c.platform} className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-white">{PLATFORM_LABEL[c.platform]}</div>
                <div className="text-xs text-zinc-500">
                  {c.connected ? (
                    <span className="text-emerald-400">
                      Connected as {c.account}
                      {c.expiresAt && <span className="text-zinc-500"> · reconnect before {new Date(c.expiresAt).toLocaleDateString()}</span>}
                    </span>
                  ) : c.configured ? (
                    "Ready to connect"
                  ) : (
                    "App credentials missing in .env.local"
                  )}
                </div>
              </div>
              {c.connected && (
                <button
                  onClick={() => api(`/api/auth/${c.platform}/disconnect`).then(conns.refresh)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
                >
                  Disconnect
                </button>
              )}
              {c.configured && (
                <a href={`/api/auth/${c.platform}/start`} className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20">
                  {c.connected ? "Reconnect" : "Connect"}
                </a>
              )}
            </div>
            {!c.connected && (
              <div className="mt-4 space-y-2 rounded-xl bg-black/30 p-4 text-xs text-zinc-400">
                <ol className="list-decimal space-y-1 pl-4">
                  {SETUP[c.platform].steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <div>
                  Redirect URI: <code className="select-all rounded bg-white/5 px-1.5 py-0.5 text-zinc-200">{c.redirectUri}</code>
                </div>
                <div>
                  .env.local:{" "}
                  {SETUP[c.platform].env.map((e) => (
                    <code key={e} className="mr-1 rounded bg-white/5 px-1.5 py-0.5 text-zinc-200">
                      {e}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      {settings.data && (
        <section className="rounded-2xl border border-white/5 bg-zinc-900/50 p-5">
          <h2 className="mb-4 font-medium text-white">Posting defaults</h2>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <Field label="Default voice">
              <select value={settings.data.voice} onChange={(e) => save({ voice: e.target.value })} className={select}>
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="YouTube visibility">
              <select value={settings.data.youtubePrivacy} onChange={(e) => save({ youtubePrivacy: e.target.value as Settings["youtubePrivacy"] })} className={select}>
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </Field>
            <Field label="TikTok mode">
              <select value={settings.data.tiktokMode} onChange={(e) => save({ tiktokMode: e.target.value as Settings["tiktokMode"] })} className={select}>
                <option value="direct">Direct post</option>
                <option value="inbox">Send to TikTok inbox (finish in app)</option>
              </select>
            </Field>
            <Field label="TikTok visibility (direct post)">
              <select value={settings.data.tiktokPrivacy} onChange={(e) => save({ tiktokPrivacy: e.target.value as Settings["tiktokPrivacy"] })} className={select}>
                <option value="SELF_ONLY">Only me (required until app is audited)</option>
                <option value="MUTUAL_FOLLOW_FRIENDS">Friends</option>
                <option value="FOLLOWER_OF_CREATOR">Followers</option>
                <option value="PUBLIC_TO_EVERYONE">Everyone</option>
              </select>
            </Field>
          </div>
        </section>
      )}
    </div>
  );
}

const select = "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-zinc-200";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-zinc-400">
      <span>{label}</span>
      {children}
    </label>
  );
}
