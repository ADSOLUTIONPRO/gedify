/**
 * View model d'un document, construit côté serveur (page.tsx) puis passé aux
 * composants client de l'espace Documents.
 *
 * Objectif : exposer uniquement des informations « métier » sérialisables —
 * jamais d'UUID, task_id, ni métadonnée technique. Le titre métier est résolu
 * en amont (override utilisateur > IA > Gedify > nom de fichier > #id).
 */

import type { AiActionId } from "@/lib/documents/document-ai";

/** Jeu d'actions document partagé (analyse, fiche, édition, envoi, suppression…),
 *  utilisé par les cartes/lignes et la barre d'actions groupées. */
export type DocActionHandlers = {
  onView: (doc: DocumentVM) => void;
  onAi: (doc: DocumentVM, action: AiActionId) => void;
  onFicheIA: (doc: DocumentVM) => void;
  onEdit: (doc: DocumentVM) => void;
  onAddToFolder: (doc: DocumentVM) => void;
  onSendMail: (doc: DocumentVM) => void;
  onDownload: (doc: DocumentVM) => void;
  onArchive: (doc: DocumentVM) => void;
  onDelete: (doc: DocumentVM) => void;
};

export type DocumentTagVM = {
  /** Identifiant Gedify (présent quand connu, pour l'édition des tags). */
  id?: number;
  name: string;
  color?: string;
  text_color?: string;
};

export type DocumentStatus = "todo" | "validated" | "archived";

export type DocumentAmountVM = {
  label: string;
  amount: number;
  currency: string;
};

export type DocumentDueVM = {
  label: string;
  iso: string;
  formatted: string;
};

export const STATUS_META: Record<DocumentStatus, { label: string; tone: "amber" | "emerald" | "slate" }> = {
  todo: { label: "À traiter", tone: "amber" },
  validated: { label: "Validé", tone: "emerald" },
  archived: { label: "Archivé", tone: "slate" },
};

export function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toLocaleString("fr-FR")} ${currency}`;
  }
}

/** Synthèse IA sérialisable, attachée au document pour la « Fiche IA ». */
export type DocumentAiVM = {
  summary: string;
  explanation: string;
  kind: string | null;
  correspondentName: string | null;
  /** Correspondants secondaires proposés par l'IA (noms). */
  secondaryCorrespondentNames: string[];
  typeName: string | null;
  tagNames: string[];
  dates: { label: string; iso: string; formatted: string }[];
  amounts: { label: string; formatted: string; amount: number; currency: string }[];
  actions: { type: string; title: string }[];
  confidence: "low" | "medium" | "high" | string | null;
  /** Score de confiance global en pourcentage (0–100), si connu. */
  confidencePct: number | null;
  /** Vrai si l'analyse demande une vérification humaine. */
  needsReview: boolean;
  /** Champs déjà appliqués au document (correspondant, type, tags, dossier…). */
  appliedFields: string[];
  /** Origine du classement : openai | learned_template | similar | rule | user. */
  source: string | null;
  /** Modèle appris ayant servi au classement (libellé) + similarité (0–100). */
  matchedTemplateLabel: string | null;
  similarityPct: number | null;
  /** Date de dernière analyse (ISO), pour l'en-tête de la Fiche IA. */
  analyzedAt: string | null;
};

/** Statuts dérivés (OCR / IA / budget / classement) affichés sur les vignettes. */
export type DocumentStatusesVM = {
  ocr: "done" | "low" | "pending";
  ai: "none" | "done" | "review" | "error";
  /** Score de confiance IA en % (0–100), null si non analysé. */
  confidencePct: number | null;
  budget: "none" | "created" | "review";
  classified: boolean;
  /** Origine « apprise » du classement, pour le badge vignette. */
  learned: "template" | "similar" | null;
  /** Libellé du modèle appris associé (tooltip « Similaire à … »). */
  matchedLabel: string | null;
  /** Code d'erreur de la miniature (placeholder affiché). Null si OK. */
  thumbnailError?: string | null;
};

export type DocumentVM = {
  id: number;
  /** Titre métier prioritaire (jamais le nom de fichier brut). */
  displayTitle: string;
  /** Sous-titre discret : nom de fichier ou source, si différent du titre. */
  fileName: string | null;
  /** Sous-titre métier : correspondant · type. */
  subtitle: string;
  correspondentName: string | null;
  correspondentId: number | null;
  typeName: string | null;
  typeId: number | null;
  tagIds: number[];
  /** Date du document (déjà formatée). */
  dateLabel: string;
  /** Date du document (ISO brut) — pour l'édition inline (input type=date). */
  createdISO: string | null;
  /** Titre Gedify brut (distinct du titre métier `displayTitle`). */
  titleRaw: string | null;
  /** Libellé de la source d'import (lecture seule) : type de fichier / Gedify. */
  sourceLabel: string | null;
  /** Date d'ajout ISO (pour tri/affichage). */
  added: string | null;
  tags: DocumentTagVM[];
  status: DocumentStatus;
  asn: string | null;
  /** Montant détecté par l'IA, uniquement si présent. */
  amount: DocumentAmountVM | null;
  /** Échéance détectée par l'IA, uniquement si présente. */
  due: DocumentDueVM | null;
  thumbUrl: string;
  detailHref: string;
  downloadUrl: string;
  paperlessUrl: string | null;
  /** Type MIME (pour conditionner les actions PDF, ex. signature). */
  mimeType: string | null;
  /** Synthèse IA (résumé, suggestions, détections) si une analyse existe. */
  ai: DocumentAiVM | null;
  /** Statuts dérivés OCR/IA/budget/classement pour les badges de vignette. */
  statuses: DocumentStatusesVM;
};
