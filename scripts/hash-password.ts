#!/usr/bin/env tsx
/**
 * Génère un hash scrypt d'un mot de passe pour la variable ADMIN_PASSWORD_HASH.
 *
 * Usage :
 *   npm run hash-password -- "mon_mot_de_passe"
 *
 * Copiez la sortie dans votre .env.local :
 *   ADMIN_PASSWORD_HASH=<valeur affichée>
 */
import { scryptSync, randomBytes } from "node:crypto";

const plain = process.argv[2];

if (!plain || plain.length < 6) {
  console.error("Usage : npm run hash-password -- \"<mot_de_passe>\"  (6 caractères minimum)");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(plain, salt, 64).toString("hex");
const result = `${salt}:${hash}`;

console.log("\n✓ Hash généré (copiez cette valeur dans ADMIN_PASSWORD_HASH) :\n");
console.log(result);
console.log();
