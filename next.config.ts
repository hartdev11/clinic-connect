import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "profile.line-scdn.net", pathname: "/**" },
      { protocol: "https", hostname: "obs.line-scdn.net", pathname: "/**" },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...config.resolve.alias,
        "@prisma/instrumentation": path.join(__dirname, "src/lib/empty-prisma-stub.js"),
      };
    }
    return config;
  },
};

export default nextConfig;
