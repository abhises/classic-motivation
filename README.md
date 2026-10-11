# Shorts Studio

A Next.js dashboard around `../shorts-maker/make_short.py`: you type a topic, watch the video get built
step by step, then post it to **YouTube Shorts**, **Instagram Reels** and **TikTok**, by hand or on a schedule.

```
topic → Gemini script → edge-tts voice → Pexels clips → ffmpeg render → upload to YT / IG / TikTok
```

## Run

```bash
cd studio
cp .env.example .env.local   # fill in the platforms you want (see below)
npm install
npm run dev                  # http://localhost:3000
npm run tunnel               # optional, 2nd terminal: public https URL, writes it into APP_URL
```

The Python side still uses `shorts-maker/.env` (GEMINI_API_KEY, PEXELS_API_KEY) and its `.venv`.

## Pages

| Page | What it does |
| --- | --- |
| **Studio** | Start a video. Shows the pipeline live: stage stepper, a storyboard of each scene (narration, search term, voice length, clip preview as it renders), a phone preview, and the raw log. You can tick platforms to auto-post when rendering finishes. |
| **Library** | Every finished `output/*/final.mp4`, with the caption and Post / Retry buttons for each platform. |
| **Autopilot** | Every N hours, takes the next line from `shorts-maker/topics.txt`, renders it and posts it to the platforms you choose. Used topics go to `topics-done.txt`. |
| **Accounts** | Connect / disconnect each platform (OAuth) and set posting defaults (voice, YouTube visibility, TikTok mode). |

Autopilot runs inside the Next.js server, so the server must stay running (`npm run build && npm start`
on an always-on machine). To trigger one cycle from cron instead: `curl -X POST http://localhost:3000/api/autopilot/run`.

## Connecting platforms

Each platform needs a developer app you create once. The Accounts page shows the exact redirect URI to register.

### YouTube
1. [Google Cloud Console](https://console.cloud.google.com/) → new project → enable **YouTube Data API v3**.
2. OAuth consent screen → External → add your Google account as a **test user**.
3. Credentials → OAuth client ID → *Web application* → redirect URI `http://localhost:3000/api/auth/youtube/callback`.
4. Put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env.local`.

> Videos uploaded from an **unverified** API project stay private until Google audits the project.
> The default quota (10,000 units/day) allows about 6 uploads a day.

### OAuth relay (permanent https redirect URI, no tunnel)
Instagram and TikTok only accept **https** redirect URIs, and a quick tunnel gets a new URL on every run. Instead,
publish `docs/` with GitHub Pages and set `OAUTH_RELAY_URL=https://<user>.github.io/<repo>/oauth`. The redirect URIs
to register become `OAUTH_RELAY_URL/instagram.html` and `OAUTH_RELAY_URL/tiktok.html`; those pages forward the
browser to `http://localhost:<port>/api/auth/<platform>/callback`. YouTube keeps using
`http://localhost:<port>/api/auth/youtube/callback`. Open the studio on `http://localhost:<port>` when you connect
an account, because the login cookie is set for that address.

### Instagram (Reels)
1. The Instagram account must be **Business** or **Creator**.
2. [developers.facebook.com](https://developers.facebook.com/) → Create app → add the **Instagram** product →
   *API setup with Instagram login*.
3. Add the redirect URI under Business login settings. In development mode, add your IG account as a tester.
4. Put the **Instagram** app ID/secret in `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET`.

The video is uploaded directly (resumable upload). If Instagram rejects that, set `PUBLIC_BASE_URL` to a public
https URL for this app; Instagram then downloads the file itself. Tokens last 60 days and refresh automatically when the app is used.

### TikTok
1. [developers.tiktok.com](https://developers.tiktok.com/) → create an app → add **Login Kit** and
   **Content Posting API** (turn on *Direct Post*). Scopes: `user.info.basic`, `video.publish`, `video.upload`.
2. TikTok requires an **https** redirect URI, so run a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`
   or `ngrok http 3000`), set `APP_URL` to the tunnel URL, and register `APP_URL/api/auth/tiktok/callback`.
   **Set `STUDIO_PASSWORD` when you use a tunnel**, because the tunnel makes the studio reachable from the internet.
3. Put `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` in `.env.local`.

> Until TikTok audits your app, direct posts can only be **private (SELF_ONLY)**. To post publicly before then, pick
> *Send to TikTok inbox* in Accounts: the video goes to your TikTok app's inbox and you tap Post there.

## Where things are stored

- `studio/data/connections.json`: OAuth tokens (gitignored; keep it private)
- `studio/data/settings.json`, `studio/data/jobs.json`: settings and job history
- `shorts-maker/output/<slug>/published.json`: per-video post status and links

## Code map

- `src/lib/jobs.ts`: job queue; runs `make_short.py` with `SHORTS_EVENTS=1` and parses its `@@EVENT` progress lines
- `src/lib/publish/{youtube,instagram,tiktok}.ts`: OAuth and upload for each platform
- `src/lib/autopilot.ts`: scheduler, started from `src/instrumentation.ts`
- `src/app/api/*`: JSON API used by the pages
