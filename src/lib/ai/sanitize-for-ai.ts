import "server-only";

/* ────────────────────────────────────────────────────────────────────────
   sanitizeForAi (Partie 7) — filet de sécurité défensif AVANT tout envoi de
   données vers un fournisseur IA externe (OpenAI…).

   Retire UNIQUEMENT les champs dont le NOM révèle un secret (hash de mot de
   passe, tokens OAuth, clés API, secrets d'environnement…). Ne touche jamais au
   contenu métier légitime (OCR, titres, résumés) : un résultat d'outil normal
   passe inchangé. C'est une défense en profondeur — ces champs ne devraient
   jamais figurer dans un payload IA, mais s'ils s'y glissent, ils sont masqués.

   RÈGLE ABSOLUE : ne jamais transmettre password_hash / access_token /
   refresh_token / OPENAI_API_KEY / AUTH_SECRET / DATABASE_URL / secrets SMTP /
   OAuth client secret. Cf. l'audit `gedify:security:inspect`.
   ──────────────────────────────────────────────────────────────────────── */

const REDACTED = "[redacted]";

/** Un nom de clé révèle-t-il un secret ? (insensible à la casse / au séparateur) */
function isSecretKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[_-]/g, "");
  return (
    k.includes("passwordhash") ||
    k === "password" ||
    k.includes("accesstoken") ||
    k.includes("refreshtoken") ||
    k.includes("idtoken") ||
    k.includes("oauthtoken") ||
    k.includes("apikey") ||
    k.includes("secret") || // authSecret, clientSecret, smtpSecret…
    k.includes("authorization") ||
    k === "cookie" ||
    k.includes("sessiontoken") ||
    k.includes("databaseurl") ||
    k.includes("connectionstring") ||
    k.includes("privatekey") ||
    k.includes("encryptedrefreshtoken") ||
    k.includes("cachedaccesstoken") ||
    (k.endsWith("token") && k !== "tokencount" && k !== "tokens") ||
    (k.endsWith("key") && k !== "key" && k !== "sortkey" && k !== "cachekey")
  );
}

/**
 * Copie profonde en masquant les clés sensibles. Tolère les cycles, borne la
 * profondeur (garde-fou anti-récursion). Best-effort : ne lève jamais.
 */
export function sanitizeForAi<T>(value: T, depth = 0, seen = new WeakSet<object>()): T {
  if (value == null || depth > 12) return value;
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeForAi(v, depth + 1, seen)) as unknown as T;
  }
  if (typeof value === "object") {
    if (seen.has(value as object)) return REDACTED as unknown as T;
    seen.add(value as object);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSecretKey(k) ? REDACTED : sanitizeForAi(v, depth + 1, seen);
    }
    return out as unknown as T;
  }
  return value;
}
