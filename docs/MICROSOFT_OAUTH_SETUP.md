# Connecteur Microsoft / Outlook (Microsoft Graph)

Connecte les boîtes **Outlook.com, Hotmail, Live, Microsoft 365 et Exchange
Online** via **OAuth 2.0 Authorization Code** côté serveur et **Microsoft Graph**
(lecture des messages/dossiers/brouillons/envoyés, envoi avec pièces jointes,
agenda et contacts). L'authentification basique IMAP/SMTP par mot de passe est
désactivée par Microsoft : seule cette méthode fonctionne.

Routes : `/api/connectors/outlook/{start,callback,status,disconnect}`.
**URI de redirection (callback) à déclarer dans Entra :**

```
https://VOTRE-DOMAINE/api/connectors/outlook/callback
```

La valeur doit être **strictement identique** à `MICROSOFT_REDIRECT_URI`.

## 1. Enregistrer l'application Microsoft Entra (Azure AD)

1. Portail Entra → **App registrations** → **New registration**.
2. **Supported account types** : « Comptes dans un annuaire organisationnel
   quelconque **et** comptes Microsoft personnels » (cohérent avec l'autorité
   `common`).
3. **Authentication** → **Add a platform** → **Web** → Redirect URI =
   `https://VOTRE-DOMAINE/api/connectors/outlook/callback`.
4. **API permissions** → **Add a permission** → **Microsoft Graph** →
   **Delegated permissions**, cocher :
   - `User.Read`
   - `Mail.ReadWrite`
   - `Mail.Send`
   - `Calendars.ReadWrite`
   - `Contacts.ReadWrite`
   - `offline_access`
   - `openid`, `email`, `profile`
5. **Certificates & secrets** → **New client secret** → copier la valeur.

## 2. Variables d'environnement

Mêmes variables pour **Coolify (PostgreSQL)** et **Synology (SQLite)** :

| Variable | Rôle | Requis |
|---|---|---|
| `MICROSOFT_CLIENT_ID` | Application (client) ID de l'app Entra | oui |
| `MICROSOFT_CLIENT_SECRET` | Secret client | oui |
| `MICROSOFT_REDIRECT_URI` | = URL de callback ci-dessus | oui |
| `CONNECTOR_SECRET_KEY` | Clé AES-256-GCM (16+ car.) chiffrant access/refresh tokens (partagée avec Gmail) | oui* |
| `MICROSOFT_OAUTH_STATE_SECRET` | Secret HMAC du state OAuth ; repli sur `CONNECTOR_SECRET_KEY` | non |
| `MICROSOFT_TENANT` | `common` (défaut), `consumers`, `organizations` ou GUID | non |
| `MICROSOFT_SCOPES` | Surcharge des scopes Graph (laisser vide) | non |

\* `CONNECTOR_SECRET_KEY` (ou à défaut `MAIL_CONNECTOR_KEY`) est indispensable :
sans lui, les tokens ne peuvent pas être chiffrés et la connexion est refusée.

Tant que `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` et
`MICROSOFT_REDIRECT_URI` ne sont pas définis, le bouton « Continuer avec
Microsoft » s'affiche désactivé.

## 3. Stockage et déploiements

- Tokens chiffrés dans la table/fichier **séparés** `outlook_oauth_tokens` /
  `outlook-tokens.json` (jamais mélangés avec Gmail).
- **Coolify (PostgreSQL)** : stockage Postgres automatique (`pgStorageActive`).
- **Synology (SQLite)** : stockage SQLite/JSON selon la configuration.
- Chaque compte Microsoft est un **MailAccount indépendant** ; reconnecter un
  email déjà présent **met à jour** le compte existant (jamais de doublon, ne
  remplace jamais les autres boîtes).

## 4. Renouvellement et erreurs

- `offline_access` fournit un **refresh token** ; l'access token est renouvelé
  automatiquement (rotation du refresh token gérée).
- Un refresh `invalid_grant` / `interaction_required`, ou un `401` Graph, lèvent
  `OutlookReconnectError` → l'UI propose **Reconnecter**.
- Erreurs OAuth gérées : `error`/`error_description` au callback,
  `consent_required`, `interaction_required`, state CSRF invalide/expiré,
  refresh token absent, compte déjà connecté.
