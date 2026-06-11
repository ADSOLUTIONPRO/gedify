/* Catalogue des modèles d'emails transactionnels par défaut.
   Données pures (aucune I/O serveur) : importables aussi par les scripts CLI.
   Les corps utilisent des variables {{nom}} substituées au rendu.
   Le HTML ci-dessous est le CONTENU (sans <html>/<body>) : il est inséré
   dans le layout par défaut (render.ts). */

export type DefaultTemplate = {
  key: string;
  name: string;
  category: "account" | "billing" | "subscription" | "support" | "system" | "marketing";
  subject: string;
  html: string;
  variables: string[];
  isMarketing?: boolean;
};

const p = (s: string) => `<p style="margin:0 0 14px">${s}</p>`;
const btn = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${href}" style="background:#0E7490;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-weight:700">${label}</a></p>`;
const greet = "{{recipientName}}";

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  // ── Compte / accès ──────────────────────────────────────────────────────
  {
    key: "account.welcome",
    name: "Bienvenue",
    category: "account",
    subject: "Bienvenue sur {{appName}} 🎉",
    html: p(`Bonjour ${greet},`) + p("Votre espace <strong>{{tenantName}}</strong> est prêt.") + btn("{{appUrl}}", "Accéder à mon espace"),
    variables: ["recipientName", "appName", "tenantName", "appUrl"],
  },
  {
    key: "account.invitation",
    name: "Invitation à rejoindre un espace",
    category: "account",
    subject: "Vous êtes invité(e) à rejoindre {{tenantName}}",
    html: p(`Bonjour,`) + p("{{inviterName}} vous invite à rejoindre l'espace <strong>{{tenantName}}</strong>.") + btn("{{inviteUrl}}", "Accepter l'invitation"),
    variables: ["tenantName", "inviterName", "inviteUrl"],
  },
  {
    key: "account.password_reset",
    name: "Réinitialisation du mot de passe",
    category: "account",
    subject: "Réinitialisation de votre mot de passe",
    html: p(`Bonjour ${greet},`) + p("Cliquez ci-dessous pour définir un nouveau mot de passe. Ce lien expire dans {{expiresIn}}.") + btn("{{resetUrl}}", "Réinitialiser"),
    variables: ["recipientName", "resetUrl", "expiresIn"],
  },
  {
    key: "account.email_verification",
    name: "Vérification d'adresse email",
    category: "account",
    subject: "Confirmez votre adresse email",
    html: p(`Bonjour ${greet},`) + p("Merci de confirmer votre adresse email pour activer votre compte.") + btn("{{verifyUrl}}", "Confirmer mon email"),
    variables: ["recipientName", "verifyUrl"],
  },
  {
    key: "account.login_alert",
    name: "Nouvelle connexion détectée",
    category: "account",
    subject: "Nouvelle connexion à votre compte",
    html: p(`Bonjour ${greet},`) + p("Une connexion a eu lieu le {{date}} depuis {{location}}. Si ce n'était pas vous, changez votre mot de passe immédiatement."),
    variables: ["recipientName", "date", "location"],
  },

  // ── Abonnement ──────────────────────────────────────────────────────────
  {
    key: "subscription.activated",
    name: "Abonnement activé",
    category: "subscription",
    subject: "Votre abonnement {{planName}} est actif",
    html: p(`Bonjour ${greet},`) + p("Votre abonnement <strong>{{planName}}</strong> est désormais actif. Prochaine échéance : {{nextBillingDate}}."),
    variables: ["recipientName", "planName", "nextBillingDate"],
  },
  {
    key: "subscription.trial_started",
    name: "Début de période d'essai",
    category: "subscription",
    subject: "Votre essai gratuit a commencé",
    html: p(`Bonjour ${greet},`) + p("Votre période d'essai de {{planName}} est ouverte jusqu'au {{trialEnd}}. Profitez-en !"),
    variables: ["recipientName", "planName", "trialEnd"],
  },
  {
    key: "subscription.trial_ending",
    name: "Fin d'essai imminente",
    category: "subscription",
    subject: "Votre essai se termine bientôt",
    html: p(`Bonjour ${greet},`) + p("Votre essai se termine le {{trialEnd}}. Choisissez une offre pour ne pas perdre l'accès.") + btn("{{pricingUrl}}", "Choisir une offre"),
    variables: ["recipientName", "trialEnd", "pricingUrl"],
  },
  {
    key: "subscription.plan_changed",
    name: "Changement d'offre",
    category: "subscription",
    subject: "Votre offre a été mise à jour",
    html: p(`Bonjour ${greet},`) + p("Votre offre est passée à <strong>{{planName}}</strong>."),
    variables: ["recipientName", "planName"],
  },
  {
    key: "subscription.canceled",
    name: "Abonnement annulé",
    category: "subscription",
    subject: "Votre abonnement a été annulé",
    html: p(`Bonjour ${greet},`) + p("Votre abonnement est annulé. Votre accès reste actif jusqu'au {{accessUntil}}."),
    variables: ["recipientName", "accessUntil"],
  },
  {
    key: "subscription.suspended",
    name: "Compte suspendu",
    category: "subscription",
    subject: "Votre accès est suspendu",
    html: p(`Bonjour ${greet},`) + p("L'accès à votre espace est suspendu. Régularisez votre situation pour le réactiver.") + btn("{{billingUrl}}", "Régulariser"),
    variables: ["recipientName", "billingUrl"],
  },

  // ── Facturation / paiements ──────────────────────────────────────────────
  {
    key: "billing.invoice_issued",
    name: "Nouvelle facture",
    category: "billing",
    subject: "Votre facture {{invoiceNumber}}",
    html: p(`Bonjour ${greet},`) + p("Votre facture <strong>{{invoiceNumber}}</strong> d'un montant de {{amount}} est disponible. Échéance : {{dueDate}}.") + btn("{{invoiceUrl}}", "Voir la facture"),
    variables: ["recipientName", "invoiceNumber", "amount", "dueDate", "invoiceUrl"],
  },
  {
    key: "billing.payment_succeeded",
    name: "Paiement reçu",
    category: "billing",
    subject: "Paiement confirmé — merci !",
    html: p(`Bonjour ${greet},`) + p("Nous avons bien reçu votre paiement de {{amount}} pour la facture {{invoiceNumber}}. Merci !"),
    variables: ["recipientName", "amount", "invoiceNumber"],
  },
  {
    key: "billing.payment_failed",
    name: "Échec de paiement",
    category: "billing",
    subject: "Votre paiement a échoué",
    html: p(`Bonjour ${greet},`) + p("Le paiement de {{amount}} pour la facture {{invoiceNumber}} a échoué. Merci de mettre à jour votre moyen de paiement.") + btn("{{billingUrl}}", "Mettre à jour"),
    variables: ["recipientName", "amount", "invoiceNumber", "billingUrl"],
  },
  {
    key: "billing.reminder_1",
    name: "Relance paiement (1er rappel)",
    category: "billing",
    subject: "Rappel : facture {{invoiceNumber}} en attente",
    html: p(`Bonjour ${greet},`) + p("La facture <strong>{{invoiceNumber}}</strong> ({{amount}}) reste impayée depuis le {{dueDate}}. Merci de procéder au règlement.") + btn("{{invoiceUrl}}", "Régler la facture"),
    variables: ["recipientName", "invoiceNumber", "amount", "dueDate", "invoiceUrl"],
  },
  {
    key: "billing.reminder_2",
    name: "Relance paiement (2e rappel)",
    category: "billing",
    subject: "2e rappel : facture {{invoiceNumber}} impayée",
    html: p(`Bonjour ${greet},`) + p("Malgré notre premier rappel, la facture <strong>{{invoiceNumber}}</strong> ({{amount}}) demeure impayée. Sans règlement sous {{graceDays}} jours, l'accès pourra être suspendu.") + btn("{{invoiceUrl}}", "Régler maintenant"),
    variables: ["recipientName", "invoiceNumber", "amount", "graceDays", "invoiceUrl"],
  },
  {
    key: "billing.reminder_final",
    name: "Relance paiement (dernier avis)",
    category: "billing",
    subject: "Dernier avis avant suspension — {{invoiceNumber}}",
    html: p(`Bonjour ${greet},`) + p("Dernier avis : la facture <strong>{{invoiceNumber}}</strong> ({{amount}}) est impayée. À défaut de règlement immédiat, l'accès à votre espace sera suspendu.") + btn("{{invoiceUrl}}", "Régler immédiatement"),
    variables: ["recipientName", "invoiceNumber", "amount", "invoiceUrl"],
  },
  {
    key: "billing.credit_note",
    name: "Avoir émis",
    category: "billing",
    subject: "Votre avoir {{creditNoteNumber}}",
    html: p(`Bonjour ${greet},`) + p("Un avoir <strong>{{creditNoteNumber}}</strong> de {{amount}} a été émis sur votre compte.") + btn("{{invoiceUrl}}", "Voir l'avoir"),
    variables: ["recipientName", "creditNoteNumber", "amount", "invoiceUrl"],
  },

  // ── Support ──────────────────────────────────────────────────────────────
  {
    key: "support.ticket_received",
    name: "Demande de support reçue",
    category: "support",
    subject: "Nous avons bien reçu votre demande #{{ticketRef}}",
    html: p(`Bonjour ${greet},`) + p("Votre demande <strong>#{{ticketRef}}</strong> a bien été enregistrée. Un conseiller vous répondra rapidement."),
    variables: ["recipientName", "ticketRef"],
  },
  {
    key: "support.agent_reply",
    name: "Réponse d'un conseiller",
    category: "support",
    subject: "Réponse à votre demande #{{ticketRef}}",
    html: p(`Bonjour ${greet},`) + p("Un conseiller a répondu à votre demande <strong>#{{ticketRef}}</strong>.") + btn("{{conversationUrl}}", "Voir la réponse"),
    variables: ["recipientName", "ticketRef", "conversationUrl"],
  },
  {
    key: "support.ticket_resolved",
    name: "Demande résolue",
    category: "support",
    subject: "Votre demande #{{ticketRef}} est résolue",
    html: p(`Bonjour ${greet},`) + p("Nous avons marqué votre demande <strong>#{{ticketRef}}</strong> comme résolue. N'hésitez pas à nous réécrire si besoin."),
    variables: ["recipientName", "ticketRef"],
  },

  // ── Système ──────────────────────────────────────────────────────────────
  {
    key: "system.quota_warning",
    name: "Quota bientôt atteint",
    category: "system",
    subject: "Vous approchez de votre limite {{quotaName}}",
    html: p(`Bonjour ${greet},`) + p("Vous avez utilisé {{usagePercent}} de votre quota <strong>{{quotaName}}</strong>. Pensez à augmenter votre offre si nécessaire.") + btn("{{pricingUrl}}", "Voir les offres"),
    variables: ["recipientName", "quotaName", "usagePercent", "pricingUrl"],
  },
  {
    key: "system.quota_reached",
    name: "Quota atteint",
    category: "system",
    subject: "Limite {{quotaName}} atteinte",
    html: p(`Bonjour ${greet},`) + p("Votre quota <strong>{{quotaName}}</strong> est atteint. Certaines actions sont bloquées jusqu'à augmentation de l'offre.") + btn("{{pricingUrl}}", "Augmenter mon offre"),
    variables: ["recipientName", "quotaName", "pricingUrl"],
  },
  {
    key: "system.generic_notification",
    name: "Notification générique",
    category: "system",
    subject: "{{subject}}",
    html: p(`Bonjour ${greet},`) + "{{bodyHtml}}",
    variables: ["recipientName", "subject", "bodyHtml"],
  },

  // ── Marketing (soumis à désinscription) ──────────────────────────────────
  {
    key: "marketing.newsletter",
    name: "Newsletter",
    category: "marketing",
    subject: "{{subject}}",
    html: "{{bodyHtml}}",
    variables: ["subject", "bodyHtml"],
    isMarketing: true,
  },
  {
    key: "marketing.announcement",
    name: "Annonce produit",
    category: "marketing",
    subject: "Nouveauté : {{featureName}}",
    html: p(`Bonjour ${greet},`) + p("{{message}}") + btn("{{ctaUrl}}", "{{ctaLabel}}"),
    variables: ["recipientName", "featureName", "message", "ctaUrl", "ctaLabel"],
    isMarketing: true,
  },
];

export function findDefaultTemplate(key: string): DefaultTemplate | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.key === key);
}
