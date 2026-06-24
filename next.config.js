/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Served behind Caddy at waifu.repo.box
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
      },
    ];
  },
};
module.exports = nextConfig;
