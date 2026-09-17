/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    const privateHeaders = [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ];
    return [
      { source: "/api/:path*", headers: privateHeaders },
      ...["guest-report.html", "report-viewer.html", "payment-return.html"].map(name => ({ source: `/${name}`, headers: privateHeaders })),
    ];
  },
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
