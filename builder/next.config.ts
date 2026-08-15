import type { NextConfig } from "next";

const config: NextConfig = {
  basePath: process.env.BUILDER_BASE_PATH || "",
  output: "standalone",
};

export default config;
