import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  allowedDevOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.56.1:3000", // VirtualBox host-only IP for Kali VM access
    "http://10.191.64.25:3000", // Host Wi-Fi IP (optional LAN access)
    "http://10.95.50.25:3000", // PC Wi-Fi IP (from ipconfig)
  ],

  async rewrites() {
    return [
      {
        source: "/sanctum/:path*",
        destination:
          "https://gso-backend-ldns.onrender.com/sanctum/:path*",
      },
      {
        source: "/api/:path*",
        destination: "https://gso-backend-ldns.onrender.com/api/:path*",
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8000",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "gso-backend-ldns.onrender.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;