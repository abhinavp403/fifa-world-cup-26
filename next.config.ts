import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "r2.thesportsdb.com",
        pathname: "/images/media/player/**",
      },
      {
        protocol: "https",
        hostname: "www.thesportsdb.com",
        pathname: "/images/media/player/**",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "img.sofascore.com",
      },
    ],
  },
};

export default nextConfig;
