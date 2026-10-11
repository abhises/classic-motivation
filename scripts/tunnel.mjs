// npm run tunnel: start a Cloudflare quick tunnel to the studio and write its URL into APP_URL in .env.local.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const envFile = path.join(import.meta.dirname, "..", ".env.local");
const port = process.env.PORT || "3000";

const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
if (!/^STUDIO_PASSWORD=.+/m.test(env)) {
  console.warn("WARNING: STUDIO_PASSWORD is not set in .env.local - the tunnel makes the studio public.\n");
}

const cf = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`], { stdio: ["ignore", "pipe", "pipe"] });
cf.on("error", (e) => {
  console.error(e.code === "ENOENT" ? "cloudflared is not installed." : e.message);
  process.exit(1);
});
cf.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => cf.kill(sig));

let found = false;
const onData = (chunk) => {
  if (found) return;
  const url = chunk.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  if (!url) return;
  found = true;

  const current = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
  const next = /^APP_URL=.*$/m.test(current)
    ? current.replace(/^APP_URL=.*$/m, `APP_URL=${url}`)
    : `APP_URL=${url}\n${current}`;
  fs.writeFileSync(envFile, next);

  console.log(`
Tunnel is up: ${url}
APP_URL in .env.local updated (restart "npm run dev" if it was already running).

Register these redirect URIs if you (re)connect a platform:
  Instagram: ${url}/api/auth/instagram/callback
  TikTok:    ${url}/api/auth/tiktok/callback
  YouTube:   ${url}/api/auth/youtube/callback

Studio: ${url}
Keep this terminal open; Ctrl+C stops the tunnel.`);
};
cf.stdout.on("data", onData);
cf.stderr.on("data", onData);
