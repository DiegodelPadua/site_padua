import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",

  basePath: "/site_padua",
  assetPrefix: "/site_padua/",

  images: {
    unoptimized: true,
  },

  trailingSlash: true,
};

export default nextConfig;