import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,

  // Moteur documentaire local : libs natives / lourdes laissées hors-bundle.
  serverExternalPackages: ["sharp", "@napi-rs/canvas", "tesseract.js", "pdfjs-dist"],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // frame-ancestors préféré à X-Frame-Options (CSP remplace)
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            // Autorise office.azserver.fr en iframe pour OnlyOffice (futur).
            // Tailwind v4 injecte des styles inline → unsafe-inline requis.
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-src 'self' https://office.azserver.fr",
              "frame-ancestors 'self' https://office.azserver.fr",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
