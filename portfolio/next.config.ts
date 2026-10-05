import type { NextConfig } from "next";

// Static export for Cloudflare assets. Keep server-only features (actions, APIs, middleware) out while this is on.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
