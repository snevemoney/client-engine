/* eslint-disable @typescript-eslint/no-require-imports -- Next.js config is CommonJS */
/** @type {import('next').NextConfig} */
const { catalogAliasRedirects } = require("./src/lib/catalog-alias-redirects");

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  basePath,
  output: "standalone",
  staticPageGenerationTimeout: 300,
  // Leftover /pro twins 308 to origin. /pro/login and /pro/dashboard stay.
  async redirects() {
    return catalogAliasRedirects(basePath);
  },
};

module.exports = nextConfig;
