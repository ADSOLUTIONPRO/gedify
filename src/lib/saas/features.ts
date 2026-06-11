/* Catalogue centralisé des fonctionnalités SaaS (feature flags) — Phase 8.

   Donnée pure (pas de "server-only") : importable serveur ET interface.
   Source unique : toute vérification passe par isFeatureEnabled /
   assertFeatureEnabled (cf. entitlements.ts), jamais par `if (plan === ...)`. */

import type { PlanId } from "./plans";

export type FeatureKey = string;
export type FeatureCategory = { id: string; label: string; features: { key: FeatureKey; label: string }[] };

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: "documents", label: "Documents",
    features: [
      { key: "documents_enabled", label: "Documents" },
      { key: "document_upload_enabled", label: "Upload de documents" },
      { key: "bulk_import_enabled", label: "Import en masse" },
      { key: "drag_drop_import_enabled", label: "Import glisser-déposer" },
      { key: "scanner_camera_enabled", label: "Scanner / caméra" },
      { key: "document_preview_enabled", label: "Aperçu document" },
      { key: "document_download_enabled", label: "Téléchargement" },
      { key: "document_export_enabled", label: "Export document" },
      { key: "trash_enabled", label: "Corbeille" },
      { key: "restore_deleted_documents_enabled", label: "Restauration suppressions" },
    ],
  },
  {
    id: "ocr", label: "OCR",
    features: [
      { key: "ocr_enabled", label: "OCR" },
      { key: "ocr_auto_enabled", label: "OCR automatique" },
      { key: "ocr_manual_enabled", label: "OCR manuel" },
      { key: "ocr_languages_advanced_enabled", label: "Langues OCR avancées" },
      { key: "ocr_batch_enabled", label: "OCR par lot" },
    ],
  },
  {
    id: "ai", label: "Intelligence artificielle",
    features: [
      { key: "ai_enabled", label: "IA" },
      { key: "ai_document_analysis_enabled", label: "Analyse de document IA" },
      { key: "ai_auto_classification_enabled", label: "Classement IA auto" },
      { key: "ai_suggestions_enabled", label: "Suggestions IA" },
      { key: "ai_summary_enabled", label: "Résumé IA" },
      { key: "ai_invoice_detection_enabled", label: "Détection factures IA" },
      { key: "ai_budget_detection_enabled", label: "Détection budget IA" },
      { key: "ai_email_analysis_enabled", label: "Analyse email IA" },
      { key: "ai_actions_recommendation_enabled", label: "Recommandation d'actions IA" },
      { key: "ai_chat_assistant_enabled", label: "Assistant IA (chat)" },
    ],
  },
  {
    id: "classification", label: "Classement documentaire",
    features: [
      { key: "tags_enabled", label: "Tags" },
      { key: "correspondents_enabled", label: "Correspondants" },
      { key: "document_types_enabled", label: "Types de documents" },
      { key: "folders_enabled", label: "Dossiers" },
      { key: "projects_enabled", label: "Projets" },
      { key: "custom_fields_enabled", label: "Champs personnalisés" },
      { key: "secondary_correspondents_enabled", label: "Correspondants secondaires" },
      { key: "saved_views_enabled", label: "Vues enregistrées" },
    ],
  },
  {
    id: "search", label: "Recherche",
    features: [
      { key: "search_enabled", label: "Recherche" },
      { key: "advanced_search_enabled", label: "Recherche avancée" },
      { key: "full_text_search_enabled", label: "Recherche plein texte" },
      { key: "saved_searches_enabled", label: "Recherches enregistrées" },
      { key: "filters_enabled", label: "Filtres" },
    ],
  },
  {
    id: "mail", label: "Messagerie",
    features: [
      { key: "mail_module_enabled", label: "Module messagerie" },
      { key: "email_import_enabled", label: "Import email" },
      { key: "gmail_connection_enabled", label: "Connexion Gmail" },
      { key: "email_to_document_enabled", label: "Email → document" },
      { key: "mail_attachments_import_enabled", label: "Import pièces jointes" },
      { key: "email_signatures_enabled", label: "Signatures email" },
      { key: "email_templates_enabled", label: "Modèles email" },
      { key: "email_auto_classification_enabled", label: "Classement email auto" },
    ],
  },
  {
    id: "finance", label: "Finances / budget",
    features: [
      { key: "finance_module_enabled", label: "Module finances" },
      { key: "budget_enabled", label: "Budget" },
      { key: "budget_forecast_enabled", label: "Prévisions budget" },
      { key: "budget_payments_enabled", label: "Paiements budget" },
      { key: "invoice_tracking_enabled", label: "Suivi des factures" },
      { key: "payment_status_enabled", label: "Statut de paiement" },
      { key: "debt_tracking_enabled", label: "Suivi des dettes" },
      { key: "recurring_expenses_enabled", label: "Dépenses récurrentes" },
      { key: "financial_export_enabled", label: "Export financier" },
    ],
  },
  {
    id: "calendar", label: "Calendrier / rappels",
    features: [
      { key: "reminders_enabled", label: "Rappels" },
      { key: "calendar_enabled", label: "Calendrier" },
      { key: "google_calendar_enabled", label: "Google Calendar" },
      { key: "icloud_calendar_enabled", label: "iCloud Calendar" },
      { key: "appointment_detection_enabled", label: "Détection de rendez-vous" },
      { key: "recurring_reminders_enabled", label: "Rappels récurrents" },
    ],
  },
  {
    id: "workflows", label: "Actions / workflows",
    features: [
      { key: "tasks_enabled", label: "Tâches" },
      { key: "workflows_enabled", label: "Workflows" },
      { key: "automation_rules_enabled", label: "Règles d'automatisation" },
      { key: "document_lifecycle_enabled", label: "Cycle de vie document" },
      { key: "notifications_enabled", label: "Notifications" },
      { key: "notification_preferences_enabled", label: "Préférences de notification" },
    ],
  },
  {
    id: "office", label: "Office / édition",
    features: [
      { key: "onlyoffice_enabled", label: "OnlyOffice" },
      { key: "docx_editing_enabled", label: "Édition DOCX" },
      { key: "xlsx_editing_enabled", label: "Édition XLSX" },
      { key: "pptx_editing_enabled", label: "Édition PPTX" },
      { key: "collaborative_editing_enabled", label: "Édition collaborative" },
      { key: "document_versioning_enabled", label: "Versionnement" },
    ],
  },
  {
    id: "contacts", label: "Contacts",
    features: [
      { key: "contacts_enabled", label: "Contacts" },
      { key: "contact_sync_enabled", label: "Synchro contacts" },
      { key: "google_contacts_enabled", label: "Google Contacts" },
      { key: "contact_deduplication_enabled", label: "Déduplication" },
      { key: "contact_history_enabled", label: "Historique contacts" },
    ],
  },
  {
    id: "exports", label: "Exports / sauvegardes",
    features: [
      { key: "export_zip_enabled", label: "Export ZIP" },
      { key: "export_csv_enabled", label: "Export CSV" },
      { key: "export_pdf_enabled", label: "Export PDF" },
      { key: "backup_enabled", label: "Sauvegarde" },
      { key: "restore_backup_enabled", label: "Restauration sauvegarde" },
      { key: "api_access_enabled", label: "Accès API" },
      { key: "webhook_enabled", label: "Webhooks" },
    ],
  },
  {
    id: "admin", label: "Administration client",
    features: [
      { key: "team_management_enabled", label: "Gestion d'équipe" },
      { key: "user_invitations_enabled", label: "Invitations" },
      { key: "role_management_enabled", label: "Gestion des rôles" },
      { key: "audit_logs_enabled", label: "Journaux d'audit" },
      { key: "security_logs_enabled", label: "Journaux de sécurité" },
      { key: "tenant_settings_enabled", label: "Paramètres tenant" },
      { key: "custom_branding_enabled", label: "Personnalisation marque" },
      { key: "custom_domain_enabled", label: "Domaine personnalisé" },
    ],
  },
  {
    id: "support", label: "Support / assistance",
    features: [
      { key: "help_center_enabled", label: "Centre d'aide" },
      { key: "ai_support_assistant_enabled", label: "Assistant IA (support)" },
      { key: "human_support_enabled", label: "Support humain (conseiller)" },
      { key: "priority_support_enabled", label: "Support prioritaire (SLA)" },
      { key: "support_attachments_enabled", label: "Pièces jointes au support" },
    ],
  },
];

/** Toutes les clés de fonctionnalités connues. */
export const FEATURE_KEYS: FeatureKey[] = FEATURE_CATEGORIES.flatMap((c) => c.features.map((f) => f.key));

const LABELS = new Map<FeatureKey, string>();
const CATEGORY_OF = new Map<FeatureKey, string>();
for (const c of FEATURE_CATEGORIES) {
  for (const f of c.features) {
    LABELS.set(f.key, f.label);
    CATEGORY_OF.set(f.key, c.label);
  }
}

export function getFeatureLabel(key: FeatureKey): string {
  return LABELS.get(key) ?? key;
}
export function getFeatureCategory(key: FeatureKey): string {
  return CATEGORY_OF.get(key) ?? "Autre";
}

/** Niveau de support par plan (catégorie 14). */
export const PLAN_SUPPORT_LEVEL: Record<PlanId, "none" | "standard" | "priority" | "dedicated"> = {
  free: "none", test: "none", pro: "standard", business: "priority", internal: "dedicated",
};

/* Fonctionnalités DÉSACTIVÉES par plan (le reste = activé). business/internal =
   tout activé. */
const FREE_DISABLED = new Set<FeatureKey>([
  // pas d'IA, pas d'email, pas d'OnlyOffice, pas d'automatisations, exports/limites avancées off
  ...FEATURE_CATEGORIES.find((c) => c.id === "ai")!.features.map((f) => f.key),
  ...FEATURE_CATEGORIES.find((c) => c.id === "mail")!.features.map((f) => f.key),
  ...FEATURE_CATEGORIES.find((c) => c.id === "office")!.features.map((f) => f.key),
  "bulk_import_enabled", "scanner_camera_enabled",
  "ocr_auto_enabled", "ocr_languages_advanced_enabled", "ocr_batch_enabled",
  "advanced_search_enabled", "full_text_search_enabled", "saved_searches_enabled", "saved_views_enabled",
  "projects_enabled", "custom_fields_enabled", "secondary_correspondents_enabled",
  "budget_forecast_enabled", "budget_payments_enabled", "invoice_tracking_enabled",
  "payment_status_enabled", "debt_tracking_enabled", "recurring_expenses_enabled", "financial_export_enabled",
  "google_calendar_enabled", "icloud_calendar_enabled", "appointment_detection_enabled", "recurring_reminders_enabled",
  "workflows_enabled", "automation_rules_enabled", "document_lifecycle_enabled",
  "contact_sync_enabled", "google_contacts_enabled", "contact_deduplication_enabled", "contact_history_enabled",
  "export_zip_enabled", "export_csv_enabled", "api_access_enabled", "webhook_enabled", "restore_backup_enabled",
  "team_management_enabled", "user_invitations_enabled", "role_management_enabled",
  "audit_logs_enabled", "security_logs_enabled", "custom_branding_enabled", "custom_domain_enabled",
  "collaborative_editing_enabled", "document_versioning_enabled",
  "human_support_enabled", "priority_support_enabled", "ai_support_assistant_enabled",
]);

const TEST_DISABLED = new Set<FeatureKey>([
  // proche pro mais sans email import ni fonctions "business"
  ...FEATURE_CATEGORIES.find((c) => c.id === "mail")!.features.map((f) => f.key),
  "workflows_enabled", "automation_rules_enabled", "document_lifecycle_enabled",
  "role_management_enabled", "custom_branding_enabled", "custom_domain_enabled",
  "api_access_enabled", "webhook_enabled", "collaborative_editing_enabled",
]);

const PRO_DISABLED = new Set<FeatureKey>([
  // tout sauf fonctions "business"
  "workflows_enabled", "automation_rules_enabled", "document_lifecycle_enabled",
  "role_management_enabled", "custom_branding_enabled", "custom_domain_enabled",
  "collaborative_editing_enabled",
]);

const PLAN_DISABLED: Record<PlanId, Set<FeatureKey>> = {
  free: FREE_DISABLED,
  test: TEST_DISABLED,
  pro: PRO_DISABLED,
  business: new Set(),
  internal: new Set(),
};

/** Map complète des features pour un plan (toutes les clés → booléen). */
export function getPlanFeatures(planCode: string): Record<FeatureKey, boolean> {
  const code = (planCode ?? "").trim().toLowerCase() as PlanId;
  const disabled = PLAN_DISABLED[code] ?? PLAN_DISABLED.free;
  const out: Record<FeatureKey, boolean> = {};
  for (const key of FEATURE_KEYS) out[key] = !disabled.has(key);
  return out;
}

/** Fusionne des overrides booléens sur une base de features. */
export function mergeFeatures(
  base: Record<FeatureKey, boolean>,
  ...overrides: (Record<string, unknown> | null | undefined)[]
): Record<FeatureKey, boolean> {
  const out = { ...base };
  for (const ov of overrides) {
    if (!ov || typeof ov !== "object") continue;
    for (const [k, v] of Object.entries(ov)) {
      if (typeof v === "boolean" && k in out) out[k] = v;
    }
  }
  return out;
}
