import "server-only";

import { createHmac, randomBytes } from "node:crypto";

/* TOTP (RFC 6238, SHA-1, 6 chiffres, période 30 s) — sans dépendance externe.
   Compatible Google/Microsoft Authenticator, Authy, 1Password. */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

/** Nouveau secret TOTP (base32, 20 octets). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: string, counter: number, digits = 6): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  // counter sur 8 octets big-endian (compatible >2^32).
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return (code % 10 ** digits).toString().padStart(digits, "0");
}

/** Code TOTP courant (utile pour tests/diagnostic). */
export function currentTotp(secret: string, period = 30): string {
  return hotp(secret, Math.floor(Date.now() / 1000 / period));
}

/** Vérifie un code TOTP avec fenêtre de tolérance (±window périodes). */
export function verifyTotp(secret: string, token: string, window = 1, period = 30): boolean {
  const clean = (token || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const counter = Math.floor(Date.now() / 1000 / period);
  for (let i = -window; i <= window; i++) {
    // Comparaison à temps constant-ish (longueur fixe 6).
    if (hotp(secret, counter + i) === clean) return true;
  }
  return false;
}

/** URI otpauth:// pour QR code / saisie manuelle. */
export function otpauthUri(secret: string, accountLabel: string, issuer = "Gedify"): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}
