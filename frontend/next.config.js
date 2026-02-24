/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  async rewrites() {
    console.log("Rewrites function called!"); // Added for debugging
    return [
      // Specific rules first
      {
        source: '/api/ping',
        destination: 'http://localhost:8080/api/ping',
      },
      {
        source: '/api/classes',
        destination: 'http://localhost:8080/api/classes',
      },
      // Generic rule last
      {
        source: "/api/:path*",
        destination: "http://localhost:8080/api/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://localhost:8080/uploads/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
