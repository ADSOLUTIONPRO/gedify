import { defineConfig } from "prisma/config";

// L'URL n'est nécessaire que pour `prisma db push` / migrate (schema-engine).
// On lit process.env directement : absente au `generate` (build), elle ne doit
// pas faire échouer la génération du client.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
