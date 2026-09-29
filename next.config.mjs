/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets a second local dev server (e.g. a test run) build into its own folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
