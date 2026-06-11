import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";

/* Politiques SLA par priorité (délai de première réponse). */

export type SlaPolicy = {
  id: string;
  name: string;
  priority: string;
  firstResponseMins: number;
  resolutionMins: number;
  isDefault: boolean;
};

const DEFAULT_SLA: Array<Omit<SlaPolicy, "id" | "isDefault">> = [
  { name: "Urgent", priority: "urgent", firstResponseMins: 60, resolutionMins: 240 },
  { name: "Haute", priority: "high", firstResponseMins: 240, resolutionMins: 1440 },
  { name: "Normale", priority: "normal", firstResponseMins: 480, resolutionMins: 2880 },
  { name: "Basse", priority: "low", firstResponseMins: 1440, resolutionMins: 5760 },
];

function rowTo(r: Record<string, unknown>): SlaPolicy {
  return {
    id: String(r.id), name: String(r.name), priority: String(r.priority),
    firstResponseMins: Number(r.first_response_mins), resolutionMins: Number(r.resolution_mins),
    isDefault: r.is_default === true,
  };
}

export async function listSlaPolicies(): Promise<SlaPolicy[]> {
  if (!postgresActive()) return [];
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT * FROM support_sla_policies ORDER BY first_response_mins");
    return rows.map(rowTo);
  } catch {
    return [];
  }
}

export async function getSlaForPriority(priority: string): Promise<SlaPolicy | null> {
  const policies = await listSlaPolicies();
  return policies.find((p) => p.priority === priority) ?? policies.find((p) => p.priority === "normal") ?? null;
}

/** Calcule l'échéance de première réponse à partir de la priorité. */
export async function computeSlaDue(priority: string, from = new Date()): Promise<Date | null> {
  const sla = await getSlaForPriority(priority);
  const mins = sla?.firstResponseMins ?? DEFAULT_SLA.find((d) => d.priority === priority)?.firstResponseMins ?? 480;
  return new Date(from.getTime() + mins * 60_000);
}

/** Insère les politiques SLA par défaut si absentes. */
export async function seedDefaultSla(): Promise<number> {
  if (!postgresActive()) return 0;
  const pool = await getPool();
  let created = 0;
  for (const d of DEFAULT_SLA) {
    const exists = await pool.query("SELECT 1 FROM support_sla_policies WHERE priority=$1 LIMIT 1", [d.priority]);
    if (exists.rows[0]) continue;
    await pool.query(
      "INSERT INTO support_sla_policies(id, name, priority, first_response_mins, resolution_mins, is_default) VALUES ($1,$2,$3,$4,$5,$6)",
      [randomUUID(), d.name, d.priority, d.firstResponseMins, d.resolutionMins, d.priority === "normal"],
    );
    created++;
  }
  return created;
}
