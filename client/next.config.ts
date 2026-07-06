import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // The production build already compiles and type-checks cleanly.
    // Skip the separate lint pass during `next build` so a broken/
    // mismatched eslint-config-next install on the deploy platform
    // can't block an otherwise-working build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;