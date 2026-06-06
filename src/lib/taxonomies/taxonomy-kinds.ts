/* Types de taxonomies adressables par l'autocomplétion (workflows, formulaires…).
   Fichier SANS dépendance serveur → importable côté client ET serveur. */

export type TaxonomyKind = "tag" | "correspondent" | "document_type" | "folder";

export const TAXONOMY_KINDS: readonly TaxonomyKind[] = [
  "tag",
  "correspondent",
  "document_type",
  "folder",
] as const;

export function isTaxonomyKind(x: unknown): x is TaxonomyKind {
  return typeof x === "string" && (TAXONOMY_KINDS as readonly string[]).includes(x);
}

/** kind → ressource du moteur (endpoint `/api/<resource>/`). */
export const KIND_TO_RESOURCE: Record<TaxonomyKind, string> = {
  tag: "tags",
  correspondent: "correspondents",
  document_type: "document_types",
  folder: "storage_paths",
};

/** Libellé court du type de taxonomie (affiché dans l'autocomplétion). */
export const TAXONOMY_KIND_LABEL: Record<TaxonomyKind, string> = {
  tag: "Tag",
  correspondent: "Correspondant",
  document_type: "Type de document",
  folder: "Dossier",
};

/** Libellé de l'action « créer » (ex. « Créer le tag »). */
export const TAXONOMY_CREATE_LABEL: Record<TaxonomyKind, string> = {
  tag: "Créer le tag",
  correspondent: "Créer le correspondant",
  document_type: "Créer le type de document",
  folder: "Créer le dossier",
};

export const TAXONOMY_NAME_MAX = 100;
