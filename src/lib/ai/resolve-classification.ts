import "server-only";

import { createPaperlessObject, getCorrespondents, getDocumentTypes, getTags } from "@/lib/paperless";
import { createProject, listProjectFolders, resolveFolderPath } from "@/lib/projects/project-store";

/**
 * Résout les **noms** suggérés par l'IA (correspondant / type / tags / dossier)
 * vers des **IDs** Paperless/Gedify, en **créant l'entité manquante** sans
 * doublon : match nom exact → nom normalisé → création. Filtre le tag
 * « Permis de conduire » sauf si l'OCR le mentionne réellement.
 */

const DIACRITICS = /[̀-ͯ]/g;
const PERMIS = /permis\s+de\s+conduire/i;

function norm(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findByName<T extends { id: number | string; name: string }>(list: T[], name: string): T | null {
  const lower = name.trim().toLowerCase();
  const exact = list.find((e) => e.name.toLowerCase() === lower);
  if (exact) return exact;
  const n = norm(name);
  if (!n) return null;
  return list.find((e) => norm(e.name) === n) ?? null;
}

type CreatedEntity = { id: number; name: string };

export type ResolvedEntity = { id: number; name: string; created: boolean };
export type ResolvedFolder = { id: string; name: string; created: boolean };

export type ResolvedClassification = {
  correspondent: ResolvedEntity | null;
  documentType: ResolvedEntity | null;
  tags: ResolvedEntity[];
  folder: ResolvedFolder | null;
  /** Vrai si un tag « Permis de conduire » a été ignoré (OCR non concordant). */
  permisSkipped: boolean;
};

export type ResolveInput = {
  correspondentName?: string | null;
  documentTypeName?: string | null;
  tagNames?: string[];
  folderName?: string | null;
  ocrText?: string;
};

export async function resolveClassification(input: ResolveInput): Promise<ResolvedClassification> {
  const ocrMatchesPermis = PERMIS.test(input.ocrText ?? "");

  const [corrList, typeList, tagList, folders] = await Promise.all([
    getCorrespondents({ page_size: 1000 }).then((r) => r.results ?? []),
    getDocumentTypes({ page_size: 1000 }).then((r) => r.results ?? []),
    getTags({ page_size: 1000 }).then((r) => r.results ?? []),
    listProjectFolders().catch(() => [] as { id: string; name: string }[]),
  ]);

  // ── Correspondant ──
  let correspondent: ResolvedEntity | null = null;
  const cName = input.correspondentName?.trim();
  if (cName) {
    const match = findByName(corrList, cName);
    if (match) correspondent = { id: Number(match.id), name: match.name, created: false };
    else {
      const created = await createPaperlessObject<CreatedEntity>("/api/correspondents/", { name: cName });
      correspondent = { id: Number(created.id), name: created.name, created: true };
    }
  }

  // ── Type de document ──
  let documentType: ResolvedEntity | null = null;
  const tName = input.documentTypeName?.trim();
  if (tName) {
    const match = findByName(typeList, tName);
    if (match) documentType = { id: Number(match.id), name: match.name, created: false };
    else {
      const created = await createPaperlessObject<CreatedEntity>("/api/document_types/", { name: tName });
      documentType = { id: Number(created.id), name: created.name, created: true };
    }
  }

  // ── Tags (filtre permis + dédup + cap 8) ──
  const tags: ResolvedEntity[] = [];
  const seen = new Set<string>();
  for (const raw of input.tagNames ?? []) {
    const name = raw?.trim();
    if (!name) continue;
    if (PERMIS.test(name) && !ocrMatchesPermis) {
      // tag « Permis de conduire » indu → on l'ignore.
      continue;
    }
    const key = norm(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (tags.length >= 8) break;
    const match = findByName(tagList, name);
    if (match) {
      tags.push({ id: Number(match.id), name: match.name, created: false });
    } else {
      const created = await createPaperlessObject<CreatedEntity>("/api/tags/", { name });
      tagList.push(created);
      tags.push({ id: Number(created.id), name: created.name, created: true });
    }
  }
  const permisSkipped = (input.tagNames ?? []).some((t) => PERMIS.test(t ?? "")) && !ocrMatchesPermis;

  // ── Dossier / projet (chemin hiérarchique « A / B / C » supporté) ──
  let folder: ResolvedFolder | null = null;
  const fName = input.folderName?.trim();
  if (fName) {
    if (fName.includes("/")) {
      // Crée/retrouve toute la chaîne de sous-dossiers ; renvoie la feuille.
      const leaf = await resolveFolderPath(fName);
      if (leaf) folder = { id: String(leaf.id), name: leaf.name, created: true };
    } else {
      const match = findByName(folders, fName);
      if (match) folder = { id: String(match.id), name: match.name, created: false };
      else {
        const created = await createProject({ name: fName });
        folder = { id: String(created.id), name: created.name, created: true };
      }
    }
  }

  return { correspondent, documentType, tags, folder, permisSkipped };
}
