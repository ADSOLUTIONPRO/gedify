import "server-only";

import { randomUUID, randomBytes } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { recordAudit } from "@/lib/audit/audit-store";

/* Domaines clients (sous-domaines Gedify + domaines personnalisés). */

export const RESERVED_LABELS = new Set([
  "www", "app", "admin", "api", "staging", "mail", "smtp", "support", "billing", "stripe", "static", "cdn", "assets",
]);

export type TenantDomain = {
  id: string;
  tenantId: string;
  domain: string;
  type: "subdomain" | "custom_domain";
  status: string;
  isPrimary: boolean;
  verificationToken: string | null;
  verificationStatus: string;
  sslStatus: string;
  dnsStatus: string;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  createdAt: string | null;
};

function rowTo(r: Record<string, unknown>): TenantDomain {
  const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
  return {
    id: String(r.id), tenantId: String(r.tenant_id), domain: String(r.domain),
    type: (r.type as TenantDomain["type"]) ?? "subdomain", status: String(r.status ?? "pending"),
    isPrimary: r.is_primary === true, verificationToken: (r.verification_token as string) ?? null,
    verificationStatus: String(r.verification_status ?? "pending"), sslStatus: String(r.ssl_status ?? "pending"),
    dnsStatus: String(r.dns_status ?? "pending"), lastCheckedAt: iso(r.last_checked_at), verifiedAt: iso(r.verified_at),
    createdAt: iso(r.created_at),
  };
}

const DDL = `
CREATE TABLE IF NOT EXISTS tenant_domains (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, domain TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'subdomain', status TEXT NOT NULL DEFAULT 'pending',
  is_primary BOOLEAN NOT NULL DEFAULT false, verification_token TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending', ssl_status TEXT NOT NULL DEFAULT 'pending',
  dns_status TEXT NOT NULL DEFAULT 'pending', last_checked_at TIMESTAMPTZ, verified_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ, disabled_at TIMESTAMPTZ, raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tenant_domains_tenant_idx ON tenant_domains(tenant_id);`;
let ddlEnsured = false;
async function ensureTable() { if (ddlEnsured) return; const pool = await getPool(); await pool.query(DDL); ddlEnsured = true; }

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
}

/** Valide un domaine candidat. Lève une Error explicite si invalide. */
export function assertValidDomain(domain: string, type: "subdomain" | "custom_domain", primaryDomain: string): void {
  const d = normalizeDomain(domain);
  if (!DOMAIN_RE.test(d)) throw new Error(`Domaine invalide : ${d}`);
  // Domaines réservés (app/staging globaux, etc.)
  const reservedFqdns = new Set([primaryDomain, `app.${primaryDomain}`, `staging.${primaryDomain}`, `www.${primaryDomain}`]);
  if (reservedFqdns.has(d)) throw new Error("Ce domaine est réservé à la plateforme.");
  if (type === "subdomain") {
    if (!d.endsWith(`.${primaryDomain}`)) throw new Error(`Un sous-domaine doit se terminer par .${primaryDomain}`);
    const label = d.slice(0, -(`.${primaryDomain}`).length);
    if (label.includes(".")) throw new Error("Un seul niveau de sous-domaine est autorisé.");
    if (!LABEL_RE.test(label)) throw new Error("Libellé de sous-domaine invalide.");
    if (RESERVED_LABELS.has(label)) throw new Error(`Sous-domaine réservé : ${label}`);
  }
}

export async function listDomains(tenantId?: string): Promise<TenantDomain[]> {
  if (!postgresActive()) return [];
  try {
    await ensureTable();
    const pool = await getPool();
    const { rows } = tenantId
      ? await pool.query("SELECT * FROM tenant_domains WHERE tenant_id=$1 ORDER BY is_primary DESC, created_at", [tenantId])
      : await pool.query("SELECT * FROM tenant_domains ORDER BY created_at DESC LIMIT 500");
    return rows.map(rowTo);
  } catch { return []; }
}

export async function getDomain(id: string): Promise<TenantDomain | null> {
  if (!postgresActive()) return null;
  await ensureTable();
  const pool = await getPool();
  const { rows } = await pool.query("SELECT * FROM tenant_domains WHERE id=$1 LIMIT 1", [id]);
  return rows[0] ? rowTo(rows[0]) : null;
}

export async function createDomain(input: { tenantId: string; domain: string; type: "subdomain" | "custom_domain"; primaryDomain: string }): Promise<string> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  await ensureTable();
  const domain = normalizeDomain(input.domain);
  assertValidDomain(domain, input.type, input.primaryDomain);
  const pool = await getPool();
  const dup = await pool.query("SELECT 1 FROM tenant_domains WHERE domain=$1 LIMIT 1", [domain]);
  if (dup.rows[0]) throw new Error("Ce domaine existe déjà.");
  const id = randomUUID();
  const token = input.type === "custom_domain" ? `gedify-verification=${randomBytes(16).toString("hex")}` : null;
  // Sous-domaine Gedify : DNS géré par la plateforme → vérif immédiate possible.
  const verificationStatus = input.type === "subdomain" ? "verified" : "pending";
  await pool.query(
    `INSERT INTO tenant_domains(id, tenant_id, domain, type, status, verification_token, verification_status, ssl_status, dns_status)
     VALUES ($1,$2,$3,$4,'pending',$5,$6,'pending','pending')`,
    [id, input.tenantId, domain, input.type, token, verificationStatus],
  );
  await recordAudit({ action: "tenant_domain_created", target: domain, details: `tenant=${input.tenantId} type=${input.type}` });
  return id;
}

export async function setPrimary(id: string): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  const dom = await getDomain(id);
  if (!dom) return;
  await pool.query("UPDATE tenant_domains SET is_primary=false WHERE tenant_id=$1", [dom.tenantId]);
  await pool.query("UPDATE tenant_domains SET is_primary=true, updated_at=now() WHERE id=$1", [id]);
  await recordAudit({ action: "tenant_primary_domain_changed", target: dom.domain, details: dom.tenantId });
}

export async function setDomainStatus(id: string, status: "active" | "disabled"): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  const ts = status === "active" ? "activated_at" : "disabled_at";
  await pool.query(`UPDATE tenant_domains SET status=$2, ${ts}=now(), updated_at=now() WHERE id=$1`, [id, status]);
  const dom = await getDomain(id);
  await recordAudit({ action: status === "active" ? "tenant_domain_activated" : "tenant_domain_disabled", target: dom?.domain ?? id });
}

export async function deleteDomain(id: string): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  const dom = await getDomain(id);
  await pool.query("DELETE FROM tenant_domains WHERE id=$1", [id]);
  await recordAudit({ action: "tenant_domain_deleted", target: dom?.domain ?? id });
}

/** Met à jour les statuts DNS/SSL/vérif après un contrôle. */
export async function updateDomainChecks(id: string, patch: { dnsStatus?: string; sslStatus?: string; verificationStatus?: string }): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  const sets: string[] = ["last_checked_at=now()", "updated_at=now()"];
  const vals: unknown[] = [];
  let i = 1;
  if (patch.dnsStatus) { sets.push(`dns_status=$${++i}`); vals.push(patch.dnsStatus); }
  if (patch.sslStatus) { sets.push(`ssl_status=$${++i}`); vals.push(patch.sslStatus); }
  if (patch.verificationStatus) { sets.push(`verification_status=$${++i}`); vals.push(patch.verificationStatus); if (patch.verificationStatus === "verified") sets.push("verified_at=now()"); }
  await pool.query(`UPDATE tenant_domains SET ${sets.join(", ")} WHERE id=$1`, [id, ...vals]);
}

/**
 * Résolution tenant par host (préparée). Renvoie le tenantId d'un domaine
 * ACTIF + VÉRIFIÉ uniquement. Aucune résolution sinon (sécurité).
 * NB : l'appartenance de l'utilisateur est vérifiée séparément (membership).
 */
export async function resolveTenantFromHost(host: string | null | undefined): Promise<string | null> {
  if (!host || !postgresActive()) return null;
  const domain = normalizeDomain(host.split(":")[0]);
  if (!domain) return null;
  try {
    await ensureTable();
    const pool = await getPool();
    const { rows } = await pool.query(
      "SELECT tenant_id FROM tenant_domains WHERE domain=$1 AND status='active' AND verification_status='verified' LIMIT 1",
      [domain],
    );
    return rows[0] ? String(rows[0].tenant_id) : null;
  } catch { return null; }
}
