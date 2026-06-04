import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Allow unused variables/params prefixed with _ (e.g. _req, _event)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/app/**/*.tsx"],
    rules: {
      "react-hooks/error-boundaries": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Client Prisma généré — ne pas linter du code généré.
    "src/generated/**",
    // Bundles de migration générés (esbuild) — code généré, non linté.
    "scripts/gedify-*.mjs",
    // App macOS isolée (Electron) — son propre tooling, hors du build web.
    "apps-devices/**",
  ]),
]);

export default eslintConfig;
