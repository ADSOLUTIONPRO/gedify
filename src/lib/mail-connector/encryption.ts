import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveKey(): Buffer | null {
  const secret = process.env.MAIL_CONNECTOR_KEY;
  if (!secret || secret.length < 16) {
    return null;
  }
  return createHash("sha256").update(secret).digest();
}

export function isSecureStorageReady(): boolean {
  return deriveKey() !== null;
}

export function encryptPassword(plain: string): string {
  const key = deriveKey();
  if (!key) {
    throw new Error(
      "MAIL_CONNECTOR_KEY manquant ou trop court (16+ caractères). Stockage sécurisé à connecter.",
    );
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptPassword(encoded: string): string {
  const key = deriveKey();
  if (!key) {
    throw new Error(
      "MAIL_CONNECTOR_KEY manquant. Impossible de déchiffrer le mot de passe stocké.",
    );
  }

  const parts = encoded.split(":");
  if (parts.length !== 3) {
    throw new Error("Format du mot de passe chiffré invalide.");
  }

  const [ivPart, tagPart, ciphertextPart] = parts;
  const iv = Buffer.from(ivPart, "base64");
  const authTag = Buffer.from(tagPart, "base64");
  const ciphertext = Buffer.from(ciphertextPart, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}
