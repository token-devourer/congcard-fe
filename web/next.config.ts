import type { NextConfig } from "next";
import { createRequire } from "node:module";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const require = createRequire(import.meta.url);
const nextPackageDir = path.dirname(require.resolve("next/package.json"));
const turbopackRoot = path.dirname(path.dirname(nextPackageDir));

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" }
];

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"]
  },
  turbopack: {
    root: turbopackRoot
  },
  transpilePackages: ["@congcard/shared"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
