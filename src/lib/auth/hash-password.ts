import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

/** Génère un hash scrypt au format `salt:hash` (hex). */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/** Vérifie un mot de passe contre un hash stocké. Résistant aux timing attacks. */
export function verifyPassword(plain: string, stored: string): boolean {
  const colonIdx = stored.indexOf(":");
  if (colonIdx === -1) return false;
  const salt = stored.slice(0, colonIdx);
  const storedHash = stored.slice(colonIdx + 1);
  try {
    const candidate = scryptSync(plain, salt, 64);
    const stored64 = Buffer.from(storedHash, "hex");
    if (candidate.length !== stored64.length) return false;
    return timingSafeEqual(candidate, stored64);
  } catch {
    return false;
  }
}
