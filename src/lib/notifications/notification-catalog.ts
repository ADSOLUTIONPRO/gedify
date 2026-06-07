/* ────────────────────────────────────────────────────────────────────────
   Catalogue centralisé des types de notifications GEDify, par espace.

   Principe : on ne notifie QUE des événements utiles/actionnables (pas chaque
   étape technique invisible). Chaque type porte ses valeurs par défaut
   (canal GEDify, canal email, niveau). La page Paramètres › Notifications et le
   NotificationService s'appuient sur ce catalogue — source unique de vérité.

   Extensible : ajouter un type ici le rend disponible partout (UI + service).
   Compatible client + serveur (aucune dépendance Node).
   ──────────────────────────────────────────────────────────────────────── */

export type NotifSeverity = "info" | "normal" | "important" | "critical";
export type NotifFrequency = "immediate" | "hourly" | "daily" | "weekly" | "digest" | "off";
export type NotifChannel = "inapp" | "email" | "both" | "off";

export type NotifCategoryId =
  | "documents" | "messagerie" | "contacts" | "taches" | "agenda"
  | "workflows" | "ia" | "finances" | "office" | "services" | "administration";

export type NotificationCategoryDef = {
  id: NotifCategoryId;
  label: string;
  /** Nécessite un module/flag actif (ex. finances). */
  requiresFlag?: "financeSpaceEnabled";
  adminOnly?: boolean;
};

export type NotificationEventDef = {
  /** Identifiant stable, ex. "document.import.failed". */
  type: string;
  category: NotifCategoryId;
  label: string;
  description: string;
  defaultInApp: boolean;
  defaultEmail: boolean;
  defaultSeverity: NotifSeverity;
  adminOnly?: boolean;
};

export const NOTIFICATION_CATEGORIES: NotificationCategoryDef[] = [
  { id: "documents", label: "Documents" },
  { id: "messagerie", label: "Messagerie" },
  { id: "contacts", label: "Contacts" },
  { id: "taches", label: "Mes tâches" },
  { id: "agenda", label: "Agenda" },
  { id: "workflows", label: "Workflows" },
  { id: "ia", label: "Modèles IA" },
  { id: "finances", label: "Finances", requiresFlag: "financeSpaceEnabled" },
  { id: "office", label: "Office" },
  { id: "services", label: "Services connectés" },
  { id: "administration", label: "Administration", adminOnly: true },
];

/** Événements actionnables (sous-ensemble représentatif, extensible). */
export const NOTIFICATION_EVENTS: NotificationEventDef[] = [
  // ── Documents ──
  { type: "document.imported", category: "documents", label: "Nouveau document importé", description: "Un document a été ajouté à la GED.", defaultInApp: true, defaultEmail: false, defaultSeverity: "info" },
  { type: "document.import.failed", category: "documents", label: "Import échoué", description: "L'import d'un document a échoué.", defaultInApp: true, defaultEmail: false, defaultSeverity: "important" },
  { type: "document.processing.stuck", category: "documents", label: "Traitement bloqué", description: "Un document reste bloqué dans le pipeline.", defaultInApp: true, defaultEmail: false, defaultSeverity: "important" },
  { type: "document.ocr.failed", category: "documents", label: "OCR échoué", description: "La reconnaissance de texte a échoué.", defaultInApp: true, defaultEmail: false, defaultSeverity: "normal" },
  { type: "document.ai.failed", category: "documents", label: "Analyse IA échouée", description: "L'analyse IA d'un document a échoué.", defaultInApp: true, defaultEmail: false, defaultSeverity: "normal" },
  { type: "document.to_classify", category: "documents", label: "Classement à valider", description: "Un document attend une validation de classement.", defaultInApp: true, defaultEmail: false, defaultSeverity: "normal" },
  { type: "document.duplicate", category: "documents", label: "Doublon détecté", description: "Un doublon potentiel a été détecté.", defaultInApp: true, defaultEmail: false, defaultSeverity: "normal" },
  { type: "document.attachment_imported", category: "documents", label: "Pièce jointe importée depuis un email", description: "Une PJ d'email a été importée en GED.", defaultInApp: true, defaultEmail: false, defaultSeverity: "info" },
  { type: "storage.quota.near", category: "documents", label: "Stockage proche de la limite", description: "L'espace de stockage est presque plein.", defaultInApp: true, defaultEmail: true, defaultSeverity: "important" },

  // ── Messagerie ──
  { type: "mail.received", category: "messagerie", label: "Nouveau mail reçu", description: "Un nouvel email est arrivé.", defaultInApp: false, defaultEmail: false, defaultSeverity: "info" },
  { type: "mail.received.attachment", category: "messagerie", label: "Mail avec pièce jointe", description: "Un email contient une pièce jointe.", defaultInApp: true, defaultEmail: false, defaultSeverity: "normal" },
  { type: "mail.appointment_detected", category: "messagerie", label: "Rendez-vous détecté dans un mail", description: "L'IA a repéré un rendez-vous.", defaultInApp: true, defaultEmail: false, defaultSeverity: "normal" },
  { type: "mail.task_detected", category: "messagerie", label: "Tâche détectée dans un mail", description: "L'IA a repéré une tâche.", defaultInApp: true, defaultEmail: false, defaultSeverity: "normal" },
  { type: "mail.sync.failed", category: "messagerie", label: "Synchronisation échouée", description: "La synchro de la boîte mail a échoué.", defaultInApp: true, defaultEmail: false, defaultSeverity: "important" },
  { type: "mail.account.disconnected", category: "messagerie", label: "Compte déconnecté / OAuth expiré", description: "Reconnexion de la boîte mail nécessaire.", defaultInApp: true, defaultEmail: true, defaultSeverity: "important" },
  { type: "mail.send.failed", category: "messagerie", label: "Échec d'envoi", description: "Un email n'a pas pu être envoyé.", defaultInApp: true, defaultEmail: false, defaultSeverity: "important" },
  { type: "mail.imported_to_ged", category: "messagerie", label: "Mail déplacé dans Importés en GED", description: "Un mail a été traité et classé.", defaultInApp: false, defaultEmail: false, defaultSeverity: "info" },

  // ── Contacts ──
  { type: "contact.eligible.new", category: "contacts", label: "Nouveau contact éligible détecté", description: "Un contact lié à une PJ importée est apparu.", defaultInApp: true, defaultEmail: false, defaultSeverity: "info" },
  { type: "contact.duplicate", category: "contacts", label: "Doublon potentiel", description: "Deux contacts semblent identiques.", defaultInApp: true, defaultEmail: false, defaultSeverity: "normal" },
  { type: "contact.merge.done", category: "contacts", label: "Fusion réalisée", description: "Deux contacts ont été fusionnés.", defaultInApp: true, defaultEmail: false, defaultSeverity: "info" },
  { type: "contact.sync.failed", category: "contacts", label: "Synchronisation Google/IMAP échouée", description: "La synchro des contacts a échoué.", defaultInApp: true, defaultEmail: false, defaultSeverity: "normal" },

  // ── Mes tâches ──
  { type: "task.assigned", category: "taches", label: "Tâche assignée", description: "Une tâche vous a été assignée.", defaultInApp: true, defaultEmail: true, defaultSeverity: "normal" },
  { type: "task.due_soon", category: "taches", label: "Tâche bientôt à échéance", description: "Une échéance approche.", defaultInApp: true, defaultEmail: true, defaultSeverity: "important" },
  { type: "task.overdue", category: "taches", label: "Tâche en retard", description: "Une tâche a dépassé son échéance.", defaultInApp: true, defaultEmail: true, defaultSeverity: "important" },
  { type: "task.from_email", category: "taches", label: "Tâche créée depuis un email", description: "Une tâche a été générée depuis un mail.", defaultInApp: true, defaultEmail: false, defaultSeverity: "info" },
  { type: "task.daily_digest", category: "taches", label: "Synthèse quotidienne des tâches", description: "Récapitulatif quotidien.", defaultInApp: false, defaultEmail: false, defaultSeverity: "info" },

  // ── Agenda ──
  { type: "calendar.event_detected", category: "agenda", label: "Rendez-vous détecté dans un email", description: "Un RDV a été repéré.", defaultInApp: true, defaultEmail: false, defaultSeverity: "normal" },
  { type: "calendar.reminder", category: "agenda", label: "Rappel de rendez-vous", description: "Un rendez-vous approche.", defaultInApp: true, defaultEmail: true, defaultSeverity: "important" },
  { type: "calendar.conflict", category: "agenda", label: "Conflit d'agenda", description: "Deux événements se chevauchent.", defaultInApp: true, defaultEmail: false, defaultSeverity: "important" },
  { type: "calendar.sync.failed", category: "agenda", label: "Synchronisation calendrier échouée", description: "La synchro du calendrier a échoué.", defaultInApp: true, defaultEmail: false, defaultSeverity: "normal" },

  // ── Workflows ──
  { type: "workflow.failed", category: "workflows", label: "Workflow échoué", description: "Un workflow a rencontré une erreur.", defaultInApp: true, defaultEmail: false, defaultSeverity: "important" },
  { type: "workflow.manual_step", category: "workflows", label: "Étape manuelle requise", description: "Un workflow attend une action.", defaultInApp: true, defaultEmail: false, defaultSeverity: "important" },
  { type: "workflow.too_many_failures", category: "workflows", label: "Trop d'échecs", description: "Un workflow échoue de façon répétée.", defaultInApp: true, defaultEmail: true, defaultSeverity: "important" },

  // ── Modèles IA ──
  { type: "ai.template.low_confidence", category: "ia", label: "Résultat à faible confiance", description: "Un modèle a renvoyé un résultat peu fiable.", defaultInApp: true, defaultEmail: false, defaultSeverity: "normal" },
  { type: "ai.template.too_many_errors", category: "ia", label: "Trop d'erreurs", description: "Un modèle IA échoue trop souvent.", defaultInApp: true, defaultEmail: false, defaultSeverity: "important" },

  // ── Finances (si activé) ──
  { type: "finance.invoice.overdue", category: "finances", label: "Facture en retard", description: "Une facture a dépassé son échéance.", defaultInApp: true, defaultEmail: true, defaultSeverity: "important" },
  { type: "finance.budget.exceeded", category: "finances", label: "Budget dépassé", description: "Un seuil de budget est dépassé.", defaultInApp: true, defaultEmail: false, defaultSeverity: "important" },
  { type: "finance.to_validate", category: "finances", label: "Classement budgétaire à valider", description: "Un montant détecté attend validation.", defaultInApp: true, defaultEmail: false, defaultSeverity: "normal" },

  // ── Office ──
  { type: "office.onlyoffice.error", category: "office", label: "Erreur ONLYOFFICE", description: "L'éditeur a rencontré une erreur.", defaultInApp: true, defaultEmail: false, defaultSeverity: "important" },
  { type: "office.letter.pending_send", category: "office", label: "Courrier en attente d'envoi", description: "Un courrier est prêt mais non envoyé.", defaultInApp: true, defaultEmail: false, defaultSeverity: "normal" },

  // ── Services connectés ──
  { type: "service.unavailable", category: "services", label: "Service indisponible", description: "Un service connecté est injoignable.", defaultInApp: true, defaultEmail: true, defaultSeverity: "important" },
  { type: "service.auth.expired", category: "services", label: "Autorisation expirée", description: "Une réautorisation est nécessaire.", defaultInApp: true, defaultEmail: true, defaultSeverity: "important" },
  { type: "service.recovered", category: "services", label: "Service de nouveau opérationnel", description: "Un service est revenu en ligne.", defaultInApp: true, defaultEmail: false, defaultSeverity: "info" },
  { type: "service.openai.quota", category: "services", label: "Quota OpenAI atteint", description: "Le quota d'analyse IA est atteint.", defaultInApp: true, defaultEmail: false, defaultSeverity: "important" },

  // ── Administration (admins) ──
  { type: "admin.user.new", category: "administration", label: "Nouvel utilisateur", description: "Un compte a été créé.", defaultInApp: true, defaultEmail: false, defaultSeverity: "normal", adminOnly: true },
  { type: "admin.backup.failed", category: "administration", label: "Sauvegarde échouée", description: "Une sauvegarde a échoué.", defaultInApp: true, defaultEmail: true, defaultSeverity: "critical", adminOnly: true },
  { type: "admin.storage.low", category: "administration", label: "Stockage faible", description: "L'espace disque est critique.", defaultInApp: true, defaultEmail: true, defaultSeverity: "critical", adminOnly: true },
  { type: "admin.db.readonly", category: "administration", label: "Base en lecture seule", description: "La base de données est en lecture seule.", defaultInApp: true, defaultEmail: true, defaultSeverity: "critical", adminOnly: true },
  { type: "admin.health.degraded", category: "administration", label: "Santé système dégradée", description: "L'état de santé est dégradé.", defaultInApp: true, defaultEmail: true, defaultSeverity: "important", adminOnly: true },
  { type: "admin.update.available", category: "administration", label: "Mise à jour GEDify disponible", description: "Une nouvelle version est disponible.", defaultInApp: true, defaultEmail: false, defaultSeverity: "info", adminOnly: true },
  { type: "admin.login.unknown_device", category: "administration", label: "Connexion depuis un appareil inconnu", description: "Une connexion inhabituelle a été détectée.", defaultInApp: true, defaultEmail: true, defaultSeverity: "important", adminOnly: true },
];

export function eventsByCategory(category: NotifCategoryId): NotificationEventDef[] {
  return NOTIFICATION_EVENTS.filter((e) => e.category === category);
}

export function getEventDef(type: string): NotificationEventDef | undefined {
  return NOTIFICATION_EVENTS.find((e) => e.type === type);
}
