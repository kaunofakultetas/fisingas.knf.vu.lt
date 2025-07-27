/** @type {import('next').NextConfig} */

module.exports = {
    output: 'standalone',
    images: {
        unoptimized: true,
        remotePatterns: [
          {
            protocol: "https",
            hostname: "**",
          },
        ],
    },
}