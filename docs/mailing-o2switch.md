# Mailing transactionnel SaaS (SMTP o2switch)

Module « mini-Brevo » de Gedify : emails transactionnels, relances de paiement,
campagnes et préférences de désinscription. Envoi via un compte SMTP standard
(o2switch ou autre). **Aucun secret SMTP n'est stocké en base** : tout vit dans
les variables d'environnement.

## Activation

Le mailing est **désactivé par défaut**. Tant qu'il l'est, les emails sont mis
en file (`mail_queue`) mais **jamais envoyés**.

```env
EMAILS_ENABLED=true
```

## Configuration SMTP (o2switch)

o2switch fournit un SMTP par domaine. Créez une adresse (ex. `noreply@votredomaine.fr`)
dans le cPanel, puis renseignez :

```env
SMTP_HOST=mail.votredomaine.fr      # ou le serveur SMTP o2switch indiqué dans cPanel
SMTP_PORT=465                       # 465 = SSL/TLS direct ; 587 = STARTTLS
SMTP_SECURE=true                    # true pour 465, false pour 587 (auto si omis)
SMTP_USER=noreply@votredomaine.fr
SMTP_PASSWORD=********              # ⚠️ jamais affiché ni loggé
MAIL_FROM=noreply@votredomaine.fr
MAIL_FROM_NAME=Gedify
```

`APP_URL` (ou `NEXT_PUBLIC_APP_URL`) sert à construire les liens dans les emails
(facture, désinscription, etc.).

## Vérification

Page d'admin (superuser) : **Gestion clients → Mailing**.
- État SMTP (présences uniquement, jamais le mot de passe)
- Bouton « Vérifier la connexion » (`transporter.verify()`)
- Bouton « Envoyer un test »

En ligne de commande :

```bash
npm run saas:check-mailing      # état env + stats base (n'envoie rien)
```

## Modèles d'emails

~30 modèles par défaut (comptes, abonnements, facturation, support, système,
marketing). Initialisation :

```bash
npm run saas:seed-mail-templates   # idempotent (ON CONFLICT DO NOTHING)
```

Ou via la page **Mailing → Modèles → « Initialiser les modèles »**. Chaque modèle
peut être activé/désactivé ; les corps utilisent des variables `{{nom}}`.

## File d'attente & worker

Tout envoi passe par `mail_queue` (statuts `pending|sending|sent|failed|canceled|skipped`,
ré-essais avec back-off, `dedupe_key` pour l'idempotence).

Traitement :
- Page **Mailing → File d'attente → « Traiter la file »** (manuel)
- Worker CLI : `npm run saas:process-mail-queue`
- **Cron** (recommandé en prod) :

```
GET /api/cron/mailing?key=$CRON_SECRET
```

Le cron lance les **relances de paiement** puis traite la file. Planifiez-le
toutes les 5–15 minutes (Coolify scheduled task, cron système, etc.).

## Relances de paiement & non-paiement

`runPaymentReminders()` parcourt les factures émises échues et envoie :
- `billing.reminder_1` à J+1, `billing.reminder_2` à J+7, `billing.reminder_final` à J+14
- au dernier avis (J+14), l'abonnement bascule en `unpaid` (l'accès SaaS est alors
  bloqué par `assertTenantCanUseSaas`) et un email `subscription.suspended` est envoyé.

Idempotence garantie par `dedupe_key` (`reminder:<invoiceId>:<niveau>`).

## Désinscription

Les emails **marketing** incluent un lien public `/unsubscribe?token=…` (token
opaque). Page publique sans session. Les emails **transactionnels** essentiels
(sécurité, facturation) restent envoyés sauf désinscription globale explicite.

## Isolation tenant

Aucune donnée d'un tenant ne fuit vers un autre : les destinataires des relances
et campagnes sont résolus depuis les memberships du tenant concerné (owner →
admin → premier membre). Les campagnes ciblent une audience de tenants
(tous / par plan / par statut).
