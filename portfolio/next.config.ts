import type { NextConfig } from "next";

// Static export for Cloudflare assets. Keep server-only features (actions, APIs, middleware) out while this is on.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  experimental: { inlineCss: true }, // inline the ~8 KB stylesheet: removes a render-blocking round trip (~350 ms on a real mobile network)
};

export default nextConfig;
