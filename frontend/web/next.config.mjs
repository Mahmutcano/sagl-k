/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    // Yerel geliştirme: boş NEXT_PUBLIC_API_URL ile /api proxy kullanılır.
    // Ayrı deploy: NEXT_PUBLIC_API_URL set edin; rewrite devre dışı kalır.
    if (process.env.NEXT_PUBLIC_API_URL) {
      return [];
    }
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
