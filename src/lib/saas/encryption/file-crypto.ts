import "server-only";

import { cookies, headers } from "next/headers";
import { isMultiTenantEnabled, DEFAULT_TENANT_ID, TENANT_COOKIE_NAME } from "@/lib/tenant/tenant-config";
import { getAmbientTenantId } from "@/lib/tenant/tenant-context";
import { isEncryptionConfigured } from "./master-key";
import { encodeEnvelope, decodeEnvelope, isEnvelope } from "./envelope";
import { getTenantDek, ensureTenantKey } from "./tenant-keys";

/* Couche transparente de chiffrement des fichiers, branchée dans la couche de
   stockage (engine/stores). Conçue pour être TOTALEMENT rétrocompatible :
     • écriture : chiffre seulement si la KEK est configurée ET qu'un tenant est
       résolu ; sinon écrit en clair (comportement historique) ;
     • lecture : déchiffre seulement si l'en-tête d'enveloppe est présent ;
       sinon renvoie l'octet tel quel (fichiers legacy en clair). */

/** Résout le tenant pour CHIFFRER une écriture. Léger, sans cycle d'import :
    contexte ambiant (jobs) → cookie de tenant (requête) → défaut (mono-tenant). */
async function resolveWriteTenantId(): Promise<string | null> {
  const ambient = getAmbientTenantId();
  if (ambient) return ambient;
  // Contexte requête : en-tête injecté par le proxy, sinon cookie.
  try {
    const h = await headers();
    const fromHeader = h.get("x-tenant-id");
    if (fromHeader) return fromHeader;
  } catch { /* hors requête */ }
  try {
    const c = await cookies();
    const fromCookie = c.get(TENANT_COOKIE_NAME)?.value;
    if (fromCookie) return fromCookie;
  } catch { /* hors requête */ }
  // Mono-tenant : un seul espace logique → clé par défaut.
  if (!isMultiTenantEnabled()) return DEFAULT_TENANT_ID;
  return null;
}

/** Chiffre un buffer destiné au disque si le chiffrement est actif. */
export async function encryptOnWrite(plaintext: Buffer): Promise<Buffer> {
  if (!isEncryptionConfigured()) return plaintext;
  // Déjà chiffré ? (évite un double chiffrement)
  if (isEnvelope(plaintext)) return plaintext;
  const tenantId = await resolveWriteTenantId();
  if (!tenantId) return plaintext; // pas de tenant résolu → on n'altère pas le flux
  try {
    await ensureTenantKey(tenantId);
    const dek = await getTenantDek(tenantId);
    return encodeEnvelope(tenantId, dek, plaintext);
  } catch {
    // En cas d'échec (clé indisponible), on n'empêche jamais l'écriture :
    // le fichier est écrit en clair plutôt que perdu. (Surveillé via check-encryption.)
    return plaintext;
  }
}

/** Chiffre EXPLICITEMENT pour un tenant donné (factures, pièces jointes…). */
export async function encryptForTenant(tenantId: string, plaintext: Buffer): Promise<Buffer> {
  if (!isEncryptionConfigured() || !tenantId) return plaintext;
  if (isEnvelope(plaintext)) return plaintext;
  try {
    await ensureTenantKey(tenantId);
    const dek = await getTenantDek(tenantId);
    return encodeEnvelope(tenantId, dek, plaintext);
  } catch {
    return plaintext;
  }
}

/** Déchiffre à la lecture si le buffer est une enveloppe ; sinon renvoie tel quel. */
export async function decryptOnRead(buf: Buffer): Promise<Buffer> {
  if (!isEnvelope(buf)) return buf; // fichier en clair (legacy ou chiffrement off)
  const { keyId, parts } = decodeEnvelope(buf);
  // La DEK est résolue depuis l'en-tête (tenantId) — lecture autorisée côté serveur.
  const { gcmDecrypt } = await import("./envelope");
  const dek = await getTenantDek(keyId);
  return gcmDecrypt(dek, parts, Buffer.from(keyId, "utf8"));
}

/** Indique si un buffer lu est chiffré (pour diagnostics). */
export function isEncryptedBuffer(buf: Buffer): boolean {
  return isEnvelope(buf);
}
