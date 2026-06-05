/* Catalogue d'erreurs Gedify (clôture P1→P13) : pour chaque code, une cause
   PROBABLE et une SOLUTION compréhensible, plus un libellé de relance éventuel.
   Partagé client/serveur (aucune dépendance serveur). Utilisé par GedifyErrorHint
   et GedifyProgressModal. */

export type GedifyErrorEntry = {
  /** Titre court et lisible de l'erreur. */
  title: string;
  /** Cause probable (1 phrase). */
  cause: string;
  /** Solution proposée (1-2 phrases). */
  solution: string;
  /** Libellé du bouton de relance (si une relance est pertinente). */
  retryLabel?: string;
};

export type GedifyErrorCode =
  | "thumbnail_generation_failed"
  | "preview_generation_failed"
  | "pages_generation_failed"
  | "ocr_failed"
  | "ai_failed"
  | "index_failed"
  | "import_failed"
  | "mail_sync_failed"
  | "backup_failed"
  | "postgres_connection_failed"
  | "generic";

export const ERROR_CATALOG: Record<GedifyErrorCode, GedifyErrorEntry> = {
  thumbnail_generation_failed: {
    title: "Miniature non générée",
    cause: "PDF illisible, moteur de rendu indisponible ou fichier original manquant.",
    solution: "Vérifiez que le fichier original existe, puis relancez la génération.",
    retryLabel: "Relancer miniature",
  },
  preview_generation_failed: {
    title: "Aperçu non généré",
    cause: "PDF illisible ou moteur de rendu indisponible.",
    solution: "Vérifiez le fichier original, puis relancez la génération de l'aperçu.",
    retryLabel: "Relancer l'aperçu",
  },
  pages_generation_failed: {
    title: "Pages PDF non générées",
    cause: "PDF illisible ou trop volumineux pour le moteur de rendu.",
    solution: "Vérifiez le fichier, puis relancez la génération des pages.",
    retryLabel: "Relancer les pages",
  },
  ocr_failed: {
    title: "OCR impossible",
    cause: "Fichier illisible, image trop lourde, moteur OCR indisponible ou timeout.",
    solution: "Vérifiez le document, puis relancez l'OCR. Consultez les logs OCR si besoin.",
    retryLabel: "Relancer OCR",
  },
  ai_failed: {
    title: "Analyse IA impossible",
    cause: "Clé IA absente, quota dépassé, timeout, OCR vide ou modèle indisponible.",
    solution: "Vérifiez AI_CLOUD_* / OPENAI_API_KEY, l'état du fournisseur et le texte OCR du document.",
    retryLabel: "Relancer IA",
  },
  index_failed: {
    title: "Indexation impossible",
    cause: "Texte OCR manquant ou index en erreur.",
    solution: "Lancez l'OCR si nécessaire, puis réindexez le document.",
    retryLabel: "Réindexer",
  },
  import_failed: {
    title: "Import impossible",
    cause: "Fichier non supporté, trop volumineux ou stockage indisponible.",
    solution: "Vérifiez le format et la taille du fichier, puis réessayez l'import.",
    retryLabel: "Réessayer l'import",
  },
  mail_sync_failed: {
    title: "Synchronisation mail impossible",
    cause: "Token expiré, compte déconnecté ou permission Gmail insuffisante.",
    solution: "Reconnectez le compte mail depuis Messagerie › Comptes.",
    retryLabel: "Reconnecter le compte",
  },
  backup_failed: {
    title: "Sauvegarde impossible",
    cause: "Espace disque insuffisant, base inaccessible ou permission sur le dossier backups.",
    solution: "Vérifiez l'espace disponible, la connexion à la base et le dossier de sauvegardes.",
    retryLabel: "Relancer la sauvegarde",
  },
  postgres_connection_failed: {
    title: "PostgreSQL inaccessible",
    cause: "DATABASE_URL incorrect, mot de passe invalide, base arrêtée ou utilisateur inexistant.",
    solution: "Vérifiez DATABASE_URL dans Coolify et l'état du service PostgreSQL.",
  },
  generic: {
    title: "Une erreur est survenue",
    cause: "Cause non identifiée précisément.",
    solution: "Réessayez l'action. Si le problème persiste, consultez les logs.",
    retryLabel: "Réessayer",
  },
};

export function resolveError(code?: string | null): GedifyErrorEntry {
  if (code && code in ERROR_CATALOG) return ERROR_CATALOG[code as GedifyErrorCode];
  return ERROR_CATALOG.generic;
}

/** Devine un code d'erreur à partir d'un message brut (best-effort). */
export function guessErrorCode(message?: string | null): GedifyErrorCode {
  const m = (message ?? "").toLowerCase();
  if (!m) return "generic";
  if (/thumb|vignette|miniature/.test(m)) return "thumbnail_generation_failed";
  if (/preview|aperçu|apercu/.test(m)) return "preview_generation_failed";
  if (/ocr|tesseract/.test(m)) return "ocr_failed";
  if (/openai|ai_cloud|\bia\b|quota|model|token.*expired.*ai/.test(m)) return "ai_failed";
  if (/gmail|mail.*sync|imap|oauth|token expir/.test(m)) return "mail_sync_failed";
  if (/backup|sauvegarde/.test(m)) return "backup_failed";
  if (/postgres|database_url|connection.*refused|econnrefused/.test(m)) return "postgres_connection_failed";
  if (/index/.test(m)) return "index_failed";
  if (/import|upload/.test(m)) return "import_failed";
  return "generic";
}
