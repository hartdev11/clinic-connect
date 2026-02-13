import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
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
