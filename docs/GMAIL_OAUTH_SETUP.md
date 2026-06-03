# Connecter Gmail à GED AzServer

Ce guide configure le connecteur **Gmail OAuth** côté GED AzServer. Le flux utilise OAuth2 +
PKCE-friendly state, ne stocke jamais votre mot de passe et chiffre le `refresh_token` au repos
avec AES-256-GCM.

## 1. Créer un projet Google Cloud

1. Ouvrez [Google Cloud Console](https://console.cloud.google.com).
2. Créez un nouveau projet (ou réutilisez-en un).
3. Menu **APIs & Services → OAuth consent screen** :
   - Type : **External** (sauf si vous êtes en Workspace).
   - Renseignez nom, support email, scopes, domaine.
   - Ajoutez votre adresse Gmail dans les **testeurs autorisés** tant que l'app n'est pas publiée.
4. **APIs & Services → Library → Gmail API → Enable**.

## 2. Créer les identifiants OAuth

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Type : **Web application**.
3. Nom : `GED AzServer`.
4. Authorized JavaScript origins :
   - `https://ged.azserver.fr` (en production)
   - `http://localhost:3000` (en dev)
5. Authorized redirect URIs :
   - `https://ged.azserver.fr/api/connectors/gmail/callback`
   - `http://localhost:3000/api/connectors/gmail/callback`
6. Récupérez **Client ID** et **Client Secret**.

## 3. Variables d'environnement

Dans Coolify (ou `.env.local` en dev) :

```env
GOOGLE_CLIENT_ID=<client id>
GOOGLE_CLIENT_SECRET=<client secret>
GOOGLE_REDIRECT_URI=https://ged.azserver.fr/api/connectors/gmail/callback
GOOGLE_GMAIL_SCOPES=https://www.googleapis.com/auth/gmail.readonly openid email profile
GOOGLE_OAUTH_STATE_SECRET=<32+ caractères aléatoires>
CONNECTOR_SECRET_KEY=<32+ caractères aléatoires>
APP_PUBLIC_URL=https://ged.azserver.fr
```

> ⚠️ `GOOGLE_OAUTH_STATE_SECRET` et `CONNECTOR_SECRET_KEY` doivent rester strictement côté serveur.
> Si `CONNECTOR_SECRET_KEY` n'est pas défini, le code retombe sur `MAIL_CONNECTOR_KEY` pour le
> chiffrement.

## 4. Tester en local

1. `npm run dev`
2. Ouvrir `http://localhost:3000/emails/connecter`.
3. Cliquer sur **Connecter Gmail**.
4. Vous êtes redirigé vers `accounts.google.com`. Acceptez le scope `gmail.readonly`.
5. Au retour, l'écran `/emails/comptes?gmail=connected` confirme la création.
6. Sur la fiche du compte → bouton **Synchroniser maintenant**.

## 5. Comportement par défaut

Lors de la création d'un compte Gmail :

- **Folder rules** : surveillance `INBOX` ; exclusion automatique de `SPAM`, `TRASH`, `DRAFT`,
  `SENT`, `CATEGORY_PROMOTIONS`, `CATEGORY_SOCIAL`, `CATEGORY_FORUMS`.
- **Sender filter** : `allow-all-except-blocked` avec quelques motifs marketing pré-bloqués.
- **Attachment filter** : `pdf-only` (modifiable ensuite).
- La requête Gmail utilisée par défaut :
  `has:attachment -in:spam -in:trash -category:promotions -category:social is:unread newer_than:30d`.

## 6. Sécurité

- `refresh_token` : chiffré AES-256-GCM avec `CONNECTOR_SECRET_KEY`.
- `access_token` : mis en cache (5 min restantes ignorées) en clair sur disque pour éviter de
  re-rafraîchir à chaque sync. Court terme (1 h max).
- `state` OAuth : signé HMAC-SHA256, TTL 10 min, vérifié à temps constant.
- Scope : `gmail.readonly` uniquement. Aucun accès en écriture, ni archivage automatique côté
  Gmail (par défaut).
- Tokens jamais renvoyés au client. Toutes les requêtes Gmail API se font côté serveur.
- En cas de déconnexion : appel à `https://oauth2.googleapis.com/revoke` puis suppression du
  fichier `gmail-tokens.json`.

## 7. Limites / à connecter

- **Détection de doublons** non implémentée (status `duplicate` modélisé mais non émis).
- **Archivage Gmail après import** non disponible : le scope `gmail.modify` n'est pas demandé
  par défaut. Pour l'activer plus tard, ajouter `https://www.googleapis.com/auth/gmail.modify`
  dans `GOOGLE_GMAIL_SCOPES`.
- **Workspace OAuth verification** : pour un usage hors testeurs autorisés, demandez la
  vérification Google (peut nécessiter une revue de sécurité).
- **Cron** : la synchronisation est manuelle pour l'instant (bouton). Le worker `/api/mail-connector/sync-all`
  ne couvre pas encore les comptes Gmail OAuth — extension à faire.

## 8. Dépannage

| Symptôme                                  | Action                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `OAuth Google non configuré`              | Vérifier `GOOGLE_CLIENT_ID`, `_SECRET`, `_REDIRECT_URI`, `_STATE_SECRET`. |
| Pas de `refresh_token` retourné           | Révoquer l'app dans https://myaccount.google.com/permissions et relancer.|
| `State CSRF invalide ou expiré`           | Le TTL est de 10 min. Recommencez le flux depuis `/emails/connecter`.    |
| Erreur 401 sur Gmail API                  | Le `refresh_token` est probablement révoqué. Reconnecter.                |
| « Stockage sécurisé manquant »            | Définir `CONNECTOR_SECRET_KEY` (32+ caractères).                         |
