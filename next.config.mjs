/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.ctfassets.net",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "bubblein.com.br" }],
        destination: "https://getbubblein.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.bubblein.com.br" }],
        destination: "https://getbubblein.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.getbubblein.com" }],
        destination: "https://getbubblein.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "jrhikuehsmq05iqxwk36brfx.187.77.240.247.sslip.io" }],
        destination: "https://getbubblein.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
