/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static optimization for API routes
  staticPageGenerationTimeout: 300,
};

module.exports = nextConfig;
