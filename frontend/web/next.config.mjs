/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const target = process.env.API_PROXY_TARGET ?? "http://localhost:8080";
    return [
      {
        source: "/api/:path*",
        destination: `${target}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
