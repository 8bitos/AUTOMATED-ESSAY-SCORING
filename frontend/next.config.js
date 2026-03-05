const stripTrailingSlash = (value = "") => value.replace(/\/+$/, "");

const proxyTarget = stripTrailingSlash(
  process.env.API_PROXY_TARGET || "http://localhost:8080"
);

const apiBase = stripTrailingSlash(
  process.env.NEXT_PUBLIC_API_BASE_URL || `${proxyTarget}/api`
);

const uploadsBase = stripTrailingSlash(
  process.env.NEXT_PUBLIC_UPLOADS_BASE_URL || proxyTarget
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${uploadsBase}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
