import "server-only";

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

/* Primitives AES-256-GCM + format d'enveloppe de fichier autoportant.

   Un fichier chiffré commence par un en-tête « magique » permettant de le
   distinguer d'un fichier en clair (rétrocompatibilité totale : les fichiers
   existants n'ont pas ce préfixe et sont lus tels quels).

   Format binaire :
     MAGIC(8) | VERSION(1) | KEYIDLEN(2 BE) | KEYID(n utf8) | IV(12) | TAG(16) | CIPHERTEXT
   KEYID = identifiant de la clé (tenantId) — NON secret. Sert à retrouver la
   bonne DEK au déchiffrement. Le tenantId est aussi passé en AAD (liaison). */

export const MAGIC = Buffer.from("GEDENC\x01\x00", "binary"); // 8 octets
const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;

export type GcmParts = { iv: Buffer; tag: Buffer; ciphertext: Buffer };

/** Chiffre `plaintext` avec une clé 32 octets (AES-256-GCM), AAD optionnel. */
export function gcmEncrypt(key: Buffer, plaintext: Buffer, aad?: Buffer): GcmParts {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (aad) cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, tag, ciphertext };
}

/** Déchiffre des parties GCM avec une clé 32 octets. Lève si l'auth échoue. */
export function gcmDecrypt(key: Buffer, parts: GcmParts, aad?: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, parts.iv);
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(parts.tag);
  return Buffer.concat([decipher.update(parts.ciphertext), decipher.final()]);
}

/** Le buffer commence-t-il par l'en-tête d'enveloppe chiffrée ? */
export function isEnvelope(buf: Buffer): boolean {
  return buf.length >= MAGIC.length && buf.subarray(0, MAGIC.length).equals(MAGIC);
}

/** Encode une enveloppe de fichier complète (en-tête + données chiffrées). */
export function encodeEnvelope(keyId: string, key: Buffer, plaintext: Buffer): Buffer {
  const aad = Buffer.from(keyId, "utf8");
  const { iv, tag, ciphertext } = gcmEncrypt(key, plaintext, aad);
  const keyIdBuf = Buffer.from(keyId, "utf8");
  const header = Buffer.alloc(MAGIC.length + 1 + 2);
  MAGIC.copy(header, 0);
  header.writeUInt8(VERSION, MAGIC.length);
  header.writeUInt16BE(keyIdBuf.length, MAGIC.length + 1);
  return Buffer.concat([header, keyIdBuf, iv, tag, ciphertext]);
}

export type DecodedEnvelope = { keyId: string; version: number; parts: GcmParts };

/** Décode l'en-tête d'enveloppe (sans déchiffrer). Lève si malformé. */
export function decodeEnvelope(buf: Buffer): DecodedEnvelope {
  if (!isEnvelope(buf)) throw new Error("Buffer non chiffré (en-tête absent).");
  let off = MAGIC.length;
  const version = buf.readUInt8(off); off += 1;
  const keyIdLen = buf.readUInt16BE(off); off += 2;
  const keyId = buf.subarray(off, off + keyIdLen).toString("utf8"); off += keyIdLen;
  const iv = buf.subarray(off, off + IV_LEN); off += IV_LEN;
  const tag = buf.subarray(off, off + TAG_LEN); off += TAG_LEN;
  const ciphertext = buf.subarray(off);
  return { keyId, version, parts: { iv, tag, ciphertext } };
}

/* ── Wrapping de clé (DEK chiffrée par la KEK) ──────────────────────────────
   Format compact base64 : base64(IV(12) | TAG(16) | CIPHERTEXT). */

export function wrapKey(kek: Buffer, dek: Buffer, aad: string): string {
  const { iv, tag, ciphertext } = gcmEncrypt(kek, dek, Buffer.from(aad, "utf8"));
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function unwrapKey(kek: Buffer, wrapped: string, aad: string): Buffer {
  const raw = Buffer.from(wrapped, "base64");
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN);
  return gcmDecrypt(kek, { iv, tag, ciphertext }, Buffer.from(aad, "utf8"));
}
