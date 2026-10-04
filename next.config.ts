import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const BACKEND_URL = isProd
  ? "https://gso-backend-ldns.onrender.com"
  : "http://localhost:8000";

const nextConfig: NextConfig = {
  reactCompiler: true,

  allowedDevOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.56.1:3000",
    "http://10.191.64.25:3000",
    "http://10.95.50.25:3000",
  ],

  async rewrites() {
    return [
      {
        source: "/sanctum/:path*",
        destination: `${BACKEND_URL}/sanctum/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000", pathname: "/**" },
      { protocol: "https", hostname: "gso-backend-ldns.onrender.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;