import "server-only";

/* Clé maître de chiffrement (KEK). Lue UNIQUEMENT depuis l'environnement
   (ENCRYPTION_MASTER_KEY) : jamais en base, jamais loggée, jamais exposée.

   Formats acceptés : base64 (recommandé, 32 octets → 44 car.) ou hex (64 car.).
   Génération : `openssl rand -base64 32`. */

let cached: Buffer | null | undefined;

function parseKey(raw: string): Buffer | null {
  const v = raw.trim();
  if (!v) return null;
  // hex (64 caractères) ?
  if (/^[0-9a-fA-F]{64}$/.test(v)) {
    return Buffer.from(v, "hex");
  }
  // base64 / base64url
  try {
    const buf = Buffer.from(v, "base64");
    if (buf.length === 32) return buf;
  } catch {
    /* ignore */
  }
  return null;
}

/** Clé maître (32 octets) ou null si non/mal configurée. */
export function getMasterKey(): Buffer | null {
  if (cached !== undefined) return cached;
  const raw = process.env.ENCRYPTION_MASTER_KEY ?? "";
  const key = raw ? parseKey(raw) : null;
  cached = key;
  return key;
}

/** Le chiffrement au repos est-il configuré (KEK valide présente) ? */
export function isEncryptionConfigured(): boolean {
  return getMasterKey() != null;
}

/** Diagnostic SANS secret : présence + validité du format, jamais la valeur. */
export function getMasterKeyStatus(): { present: boolean; valid: boolean } {
  const raw = process.env.ENCRYPTION_MASTER_KEY ?? "";
  return { present: Boolean(raw.trim()), valid: getMasterKey() != null };
}

/** Réinitialise le cache (tests). */
export function __resetMasterKeyCache(): void {
  cached = undefined;
}
