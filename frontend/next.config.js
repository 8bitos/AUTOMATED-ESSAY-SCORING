const stripTrailingSlash = (value = "") => value.replace(/\/+$/, "");

const apiBase = stripTrailingSlash(
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api"
);

const uploadsBase = stripTrailingSlash(
  process.env.NEXT_PUBLIC_UPLOADS_BASE_URL || apiBase.replace(/\/api$/, "")
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
