// Client Prisma (PostgreSQL) — Prisma 7 : driver adapter `pg`, pas de moteur
// natif au runtime. Volontairement SANS `server-only` : utilisé aussi par les
// scripts de migration (tsx). Le client est instancié paresseusement, donc
// l'importer en mode json (sans DATABASE_URL) ne déclenche aucune connexion.

import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

let client: PrismaClient | null = null;

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPrisma(): PrismaClient {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL manquante : PostgreSQL non configuré (Gedify tourne en GEDIFY_STORAGE_MODE=json par défaut).",
      );
    }
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
