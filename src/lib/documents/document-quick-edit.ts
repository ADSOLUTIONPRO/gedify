/**
 * Helpers client pour l'édition rapide d'un document depuis la sidebar
 * d'aperçu : PATCH Paperless, création d'entités (correspondant / type / tag),
 * et journalisation GED. Utilisé par `DocumentPreviewPanel` et ses sous-champs.
 */

export type DocumentPatch = {
  title?: string;
  correspondent?: number | null;
  document_type?: number | null;
  tags?: number[];
  created?: string | null;
  archive_serial_number?: string | null;
};

export type CreatedEntity = { id: number; name: string };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
    throw new Error(data.details || data.error || `Erreur ${res.status}`);
  }
  return (await res.json()) as T;
}

/** PATCH partiel d'un document Paperless. */
export async function patchDocument(id: number, patch: DocumentPatch): Promise<void> {
  const res = await fetch(`/api/paperless/documents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
    throw new Error(data.details || data.error || "Sauvegarde impossible.");
  }
}

export async function createCorrespondent(name: string): Promise<CreatedEntity> {
  const data = await postJson<{ id: number; name: string }>("/api/paperless/correspondents", { name });
  return { id: data.id, name: data.name };
}

export async function createDocumentType(name: string): Promise<CreatedEntity> {
  const data = await postJson<{ id: number; name: string }>("/api/paperless/document-types", { name });
  return { id: data.id, name: data.name };
}

export async function createTag(name: string): Promise<CreatedEntity> {
  const data = await postJson<{ id: number; name: string }>("/api/paperless/tags", { name });
  return { id: data.id, name: data.name };
}

/** Met à jour le titre métier (override GED), comme l'éditeur du détail. */
export async function patchDisplayTitle(id: number, title: string): Promise<void> {
  const res = await fetch(`/api/documents/${id}/display-title`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ displayTitle: title }),
  });
  if (!res.ok) throw new Error("Renommage impossible.");
}

/** Journalise une modification de champ dans l'historique GED. */
export async function logChange(
  documentId: number,
  fieldLabel: string,
  oldValue: string | null,
  newValue: string | null,
  user?: string | null,
): Promise<void> {
  const who = user ? ` — ${user}` : "";
  await fetch("/api/ged/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      level: "success",
      source: "GED",
      message: `${fieldLabel} modifié${who}`,
      details: `Ancien : ${oldValue ?? "Aucun"} / Nouveau : ${newValue ?? "Aucun"}`,
      documentId,
      user: user ?? null,
    }),
  }).catch(() => {});
}

/** Récupère l'utilisateur courant (pour l'attribution dans l'historique). */
export async function fetchCurrentUser(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { username?: string };
    return data.username ?? null;
  } catch {
    return null;
  }
}
