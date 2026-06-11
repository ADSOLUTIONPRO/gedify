import "server-only";

import { promises as dns } from "node:dns";

/* Vérifications DNS (best-effort). En cas d'erreur réseau, renvoie un échec
   propre plutôt que de lever. */

export async function checkCname(domain: string): Promise<{ ok: boolean; values: string[]; error?: string }> {
  try {
    const values = await dns.resolveCname(domain);
    return { ok: values.length > 0, values };
  } catch (e) {
    return { ok: false, values: [], error: e instanceof Error ? e.message : "DNS error" };
  }
}

export async function checkARecord(domain: string): Promise<{ ok: boolean; values: string[]; error?: string }> {
  try {
    const values = await dns.resolve4(domain);
    return { ok: values.length > 0, values };
  } catch (e) {
    return { ok: false, values: [], error: e instanceof Error ? e.message : "DNS error" };
  }
}

/** Vérifie qu'un domaine pointe (CNAME ou A) vers la plateforme attendue. */
export async function checkDomainDns(domain: string, expectedCname: string): Promise<{ ok: boolean; method: "cname" | "a" | "none"; detail: string }> {
  const cname = await checkCname(domain);
  if (cname.ok) {
    const match = cname.values.some((v) => v.replace(/\.$/, "").toLowerCase() === expectedCname.toLowerCase());
    return { ok: match, method: "cname", detail: cname.values.join(", ") || "—" };
  }
  const a = await checkARecord(domain);
  if (a.ok) return { ok: true, method: "a", detail: a.values.join(", ") };
  return { ok: false, method: "none", detail: cname.error || a.error || "Aucun enregistrement DNS résolu." };
}

/** Vérifie un TXT de propriété (gedify-verification=TOKEN). */
export async function validateDomainOwnership(domain: string, expectedToken: string): Promise<{ ok: boolean; detail: string }> {
  const candidates = [domain, `_gedify-verification.${domain}`];
  for (const name of candidates) {
    try {
      const records = await dns.resolveTxt(name);
      const flat = records.map((chunks) => chunks.join(""));
      if (flat.some((t) => t.includes(expectedToken))) return { ok: true, detail: name };
    } catch { /* essaie le candidat suivant */ }
  }
  return { ok: false, detail: "Enregistrement TXT de vérification introuvable." };
}
