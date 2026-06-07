import { CorrespondentsWorkspace, type CorrespondentVM } from "@/components/correspondents/correspondents-workspace";
import { getCorrespondents } from "@/lib/paperless";

export const dynamic = "force-dynamic";

/** Normalise un nom pour la détection de doublons (« à fusionner »). */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function CorrespondantsPage() {
  let correspondents: CorrespondentVM[] = [];
  let error: string | null = null;

  try {
    const data = await getCorrespondents({ page_size: 1000, ordering: "name" });
    correspondents = (data.results ?? []).map((c) => ({
      id: Number(c.id),
      name: c.name,
      documentCount: c.document_count ?? 0,
    }));
  } catch (e) {
    error = e instanceof Error ? e.message : "Erreur inconnue pendant le chargement.";
  }

  // Doublons : noms normalisés identiques (au moins deux occurrences).
  const counts = new Map<string, number>();
  for (const c of correspondents) {
    const k = normalizeName(c.name);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const duplicateIds = correspondents
    .filter((c) => (counts.get(normalizeName(c.name)) ?? 0) > 1)
    .map((c) => c.id);

  return (
    <CorrespondentsWorkspace correspondents={correspondents} duplicateIds={duplicateIds} error={error} />
  );
}
