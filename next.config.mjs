/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep @sparticuz/chromium as a real Node dependency in the Vercel function.
  // If Next bundles/relocates it, Chromium cannot find node_modules/@sparticuz/chromium/bin.
  serverExternalPackages: ["@sparticuz/chromium"],

  // Also force the Chromium binary payload into the traced server output.
  outputFileTracingIncludes: {
    "/api/report/pdf": [
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },
};

export default nextConfig;
