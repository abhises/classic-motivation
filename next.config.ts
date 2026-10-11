import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let `next dev` serve its scripts when the studio is opened through a cloudflared tunnel (needed for TikTok OAuth)
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
