/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const nextConfig = {
  basePath,
  output: "standalone",
  staticPageGenerationTimeout: 300,
};
module.exports = nextConfig;
