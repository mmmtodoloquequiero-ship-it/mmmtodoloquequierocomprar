import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development", // Optional: disable in dev for easier debugging
});

const nextConfig: NextConfig = {
  serverExternalPackages: ['@afipsdk/afip.js'],
  turbopack: {}
};

export default withSerwist(nextConfig);
