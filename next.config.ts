import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,

  // Augmente la limite d’upload côté Next.js
  experimental: {
    proxyClientMaxBodySize: "200mb",

    // Augmente la limite si tes uploads passent par des Server Actions
    serverActions: {
      bodySizeLimit: "200mb",
    },
  },

  // Moteur documentaire local : libs natives / lourdes laissées hors-bundle.
  // pg N'EST PAS ici : on le laisse bundler par Next (pur JS) → embarqué dans la
  // sortie standalone sans dépendre de node_modules au runtime.
  serverExternalPackages: [
    "sharp",
    "@napi-rs/canvas",
    "tesseract.js",
    "pdfjs-dist",
    // Extraction bureautique (require dynamiques internes : zip, codepages) :
    // externalisées pour être copiées telles quelles dans la sortie standalone.
    "mammoth",
    "xlsx",
  ],

  async redirects() {
    // Alias de navigation (réorganisation des menus) — préservent les favoris.
    return [
      // « Mes tâches » : libellé renommé, route /rappels conservée + alias.
      { source: "/mes-taches", destination: "/rappels", permanent: false },
      { source: "/tasks", destination: "/rappels", permanent: false },
      // « Réglages » retiré du rail → renvoyé vers les paramètres (Administration).
      { source: "/reglages", destination: "/parametres", permanent: false },
      // Vues enregistrées : page unique sous Documents (évite le doublon /vues).
      { source: "/vues", destination: "/organiser/vues", permanent: false },
    ];
  },

  async headers() {
    // En-têtes de sécurité STATIQUES. La Content-Security-Policy n'est PAS ici :
    // elle dépend d'une variable RUNTIME (ONLYOFFICE_DOCUMENT_SERVER_URL, inconnue
    // au build — ex. IP du NAS Synology) et est donc posée dans le middleware
    // `src/proxy.ts`, évalué à chaque requête.
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;