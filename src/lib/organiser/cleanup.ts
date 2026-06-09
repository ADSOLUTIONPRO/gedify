import type { CleanupGroup } from "@/components/organiser/cleanup-suggestions";
import type { ProjectFolder } from "@/lib/projects/project-types";
import type {
  PaperlessCorrespondent,
  PaperlessDocumentType,
  PaperlessTag,
} from "@/lib/paperless-types";

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Regroupe les éléments dont le nom normalisé est identique (doublons probables). */
function findSimilar<T extends { id: number | string; name: string }>(items: T[]): T[] {
  const byKey = new Map<string, T[]>();
  for (const item of items) {
    const key = normalizeName(item.name);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(item);
    byKey.set(key, list);
  }
  return [...byKey.values()].filter((group) => group.length > 1).flat();
}

type CleanupInput = {
  tags: PaperlessTag[];
  types: PaperlessDocumentType[];
  correspondents: PaperlessCorrespondent[];
  projects: ProjectFolder[];
  inboxCount?: number;
};

/**
 * Construit les suggestions de nettoyage à partir des données réelles
 * (Paperless + dossiers). Purement indicatif : aucune mutation.
 */
export function buildCleanupGroups({
  tags,
  types,
  correspondents,
  projects,
  inboxCount = 0,
}: CleanupInput): CleanupGroup[] {
  const unusedTags = tags.filter((t) => (t.document_count ?? 0) === 0);
  const singleUseTags = tags.filter((t) => (t.document_count ?? 0) === 1);
  const lowUseTypes = types.filter((t) => (t.document_count ?? 0) <= 1);
  const similarCorrespondents = findSimilar(correspondents);
  const emptyFolders = projects.filter((p) => (p.linkedDocumentIds?.length ?? 0) === 0);

  const groups: CleanupGroup[] = [
    {
      id: "unused-tags",
      title: "Tags inutilisés",
      description: "Tags rattachés à aucun document.",
      count: unusedTags.length,
      href: "/organiser/tags",
      items: unusedTags.map((t) => ({ label: t.name, href: "/organiser/tags" })),
    },
    {
      id: "single-use-tags",
      title: "Tags peu utilisés",
      description: "Tags utilisés une seule fois.",
      count: singleUseTags.length,
      href: "/organiser/tags",
      items: singleUseTags.map((t) => ({ label: t.name, href: `/documents?tag=${t.id}` })),
    },
    {
      id: "low-use-types",
      title: "Types peu utilisés",
      description: "Types liés à au plus un document.",
      count: lowUseTypes.length,
      href: "/organiser/types",
      items: lowUseTypes.map((t) => ({ label: t.name, href: `/documents?document_type=${t.id}` })),
    },
    {
      id: "similar-correspondents",
      title: "Correspondants similaires",
      description: "Doublons probables à fusionner.",
      count: similarCorrespondents.length,
      href: "/organiser/correspondants",
      items: similarCorrespondents.map((c) => ({ label: c.name, href: `/documents?correspondent=${c.id}` })),
    },
    {
      id: "empty-folders",
      title: "Dossiers vides",
      description: "Dossiers / projets sans document lié.",
      count: emptyFolders.length,
      href: "/organiser/dossiers",
      items: emptyFolders.map((p) => ({ label: p.name, href: `/dossiers/${p.id}` })),
    },
    {
      id: "unclassified-docs",
      title: "Documents à classer",
      description: "Documents sans type, correspondant ou tag.",
      count: inboxCount,
      href: "/documents/a-traiter",
    },
  ];

  return groups.filter((g) => g.count > 0);
}
