# Relais OAuth Microsoft (Outlook multi-tenant)

Connecter des boîtes **Outlook / Hotmail / Live / Microsoft 365** impose OAuth
(Microsoft a désactivé l'authentification basique IMAP). Or, pour un produit
**auto-hébergé distribué** (chaque client sur son NAS, son propre domaine), on ne
peut pas enregistrer 1 000 URI de redirection ni demander à chaque client de créer
une app Azure.

Le **relais OAuth** résout ça : **une seule** app Azure et **une seule** URL de
callback, hébergées par l'éditeur, servent **tous** les clients. Aucun client n'a
rien à enregistrer, et — grâce à **PKCE** — aucun secret n'est déposé sur les NAS
et **les tokens ne transitent pas** par le relais.

---

## Principe

```
Instance NAS (client)                Microsoft                 Relais (éditeur)
─────────────────────                ─────────                 ────────────────
1. /api/connectors/outlook/start
   - génère PKCE (verifier secret + challenge)
   - chiffre le verifier dans le `state`
   - met SON callback dans le `state` (instanceCallback)
   - redirect_uri = URL du RELAIS
        ────────────────────────────►  2. login + consentement
                                            ────────────────────►  3. /relay?code&state
                                                                      - lit instanceCallback
                                                                        (clair) dans le state
        ◄───────────────────────────────────────────────────────────  302 vers l'instance
4. /api/connectors/outlook/callback?code&state
   - vérifie le state (HMAC, secret de l'instance)
   - déchiffre le verifier PKCE
   - échange le code DIRECTEMENT avec Microsoft (PKCE, sans secret)
        ────────────────────────────►  5. tokens (refresh + access)
   - stocke les tokens chiffrés (CONNECTOR_SECRET_KEY) — restent sur le NAS
```

- Le **relais** ne fait qu'un `302` : il ne détient aucun secret, ne voit jamais
  de token. Le `code` qu'il réachemine est **inutilisable** sans le `code_verifier`
  PKCE, connu de la seule instance (chiffré dans le `state`).
- Le `state` est **signé (HMAC)** par l'instance avec son propre secret : le relais
  ne peut rien forger, l'instance n'accepte que les `state` qu'elle a émis.

---

## 1. Configuration ÉDITEUR (une seule fois)

### a) App Azure unique (Microsoft Entra)
1. **App registrations → New registration**.
2. **Supported account types** : *Accounts in any organizational directory and
   personal Microsoft accounts* (manifest `signInAudience = AzureADandPersonalMicrosoftAccount`).
3. **Authentication → Add a platform → Mobile and desktop applications** (client
   **public**), et ajouter l'URI de redirection du relais :
   `https://auth.mondomaine.tld/api/connectors/outlook/relay`
   (sous une plateforme « public client », l'échange de code par **PKCE sans
   secret** est autorisé — c'est ce qui évite de distribuer un secret aux NAS).
4. **Authentication → Advanced settings → Allow public client flows : Yes**.
5. **API permissions** : permissions déléguées Microsoft Graph
   `offline_access openid email profile User.Read Mail.ReadWrite Mail.Send
   Calendars.ReadWrite Contacts.ReadWrite`.
6. Noter l'**Application (client) ID**. *(Aucun client secret nécessaire en mode
   relais ; n'en distribuez pas aux instances.)*

> Variante « client confidentiel » : si vous préférez un secret, créez-le et
> distribuez-le via `MICROSOFT_CLIENT_SECRET` sur les instances ; le code l'enverra
> en plus du PKCE. Déconseillé en distribué (secret partagé sur N NAS).

### b) Déployer l'instance RELAIS
N'importe quelle instance GEDify peut servir de relais. Sur l'instance hébergée à
l'URL enregistrée ci-dessus :
```
MICROSOFT_RELAY_ENABLED=1
```
La route `/api/connectors/outlook/relay` n'est active que si ce drapeau est posé
(évite qu'une instance quelconque devienne un redirecteur ouvert).

---

## 2. Configuration CLIENT (chaque NAS)

Aucune app à créer, aucun secret, aucune URI à enregistrer. Dans le `.env.local` :
```
# App Azure partagée de l'éditeur
MICROSOFT_CLIENT_ID=<client-id-éditeur>
# URL du relais de l'éditeur (callback unique enregistré dans Azure)
MICROSOFT_RELAY_URL=https://auth.mondomaine.tld/api/connectors/outlook/relay
# Secrets PROPRES à l'instance (état OAuth + chiffrement des tokens)
MICROSOFT_OAUTH_STATE_SECRET=<aléatoire long et unique par instance>
CONNECTOR_SECRET_KEY=<16+ caractères, unique par instance>
# URL publique HTTPS de CETTE instance (où le relais renvoie le code)
GEDIFY_PUBLIC_URL=https://gedify.client.tld
```
> `MICROSOFT_REDIRECT_URI` et `MICROSOFT_CLIENT_SECRET` ne sont **pas** utilisés en
> mode relais. `GEDIFY_PUBLIC_URL` doit être l'URL HTTPS réelle de l'instance.

Le client clique simplement **Messagerie → Paramètres → Ajouter une boîte →
Continuer avec Microsoft**, se connecte et consent. Terminé.

---

## Mode DIRECT (sans relais, app par instance)

Toujours pris en charge (utile en dev / mono-instance) : créez une app Azure
propre à l'instance et définissez `MICROSOFT_CLIENT_ID`,
`MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`
(= `https://…/api/connectors/outlook/callback`) — sans `MICROSOFT_RELAY_URL`.
PKCE est appliqué en plus du secret.

---

## Variables d'environnement (récapitulatif)

| Variable | Relais (client) | Relais (instance relais) | Direct |
|---|---|---|---|
| `MICROSOFT_CLIENT_ID` | ✅ (éditeur) | — | ✅ |
| `MICROSOFT_RELAY_URL` | ✅ | — | — |
| `MICROSOFT_RELAY_ENABLED` | — | ✅ `1` | — |
| `MICROSOFT_CLIENT_SECRET` | ❌ | — | ✅ |
| `MICROSOFT_REDIRECT_URI` | ❌ | — | ✅ |
| `MICROSOFT_OAUTH_STATE_SECRET` (ou `CONNECTOR_SECRET_KEY`) | ✅ | — | ✅ |
| `CONNECTOR_SECRET_KEY` (chiffrement tokens) | ✅ | — | ✅ |
| `GEDIFY_PUBLIC_URL` | ✅ | — | recommandé |

---

## Sécurité

- **PKCE (S256)** : le `code_verifier` (secret) est chiffré (AES-256-GCM) dans le
  `state` et n'apparaît jamais en clair (URL, logs, relais).
- **State signé (HMAC)** par l'instance : anti-CSRF + anti-falsification.
- **Relais = simple aiguillage** : aucun secret, aucun token ; n'accepte de
  réacheminer que vers des callbacks `https` se terminant par
  `/api/connectors/outlook/callback`.
- **Tokens** stockés chiffrés sur le NAS du client (CONNECTOR_SECRET_KEY) — jamais
  côté éditeur.
