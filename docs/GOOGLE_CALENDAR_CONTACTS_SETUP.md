# Synchroniser l'agenda et les contacts Google (BYO)

L'**email Gmail** se connecte sans OAuth (mot de passe d'application + IMAP, voir la
modale « Ajouter une boîte »). En revanche, l'**agenda** (Google Calendar API) et
les **contacts** (Google People API) ne sont accessibles **que par OAuth** : il n'y
a pas d'équivalent « mot de passe d'application » pour ces API.

Comme Google exige un *client secret* pour l'échange **et** chaque rafraîchissement
de jeton, chaque instance utilise **sa propre app Google** (BYO) — c'est ce qui
fonctionne pleinement, rafraîchissement compris, sans dépendance à un service
central. Comptez ~10 min, une fois.

---

## 1. Créer le projet Google Cloud

1. <https://console.cloud.google.com> → **Créer un projet** (ou réutiliser).
2. **APIs & Services → Library** → activer :
   - **Google People API** (contacts)
   - **Google Calendar API** (agenda)

## 2. Écran de consentement OAuth

1. **APIs & Services → OAuth consent screen** → type **External**.
2. Renseignez nom de l'app, email d'assistance, email du développeur.
3. **Scopes** : ajoutez uniquement
   - `.../auth/calendar`
   - `.../auth/contacts.readonly`
   (Pas besoin du scope Gmail : l'email passe par IMAP.)
4. **Test users** : ajoutez **votre propre adresse Google**.

> ℹ️ En l'absence du scope Gmail (restreint), ces scopes « sensibles » n'imposent
> **pas** d'audit de sécurité CASA — la vérification Google reste légère.

## 3. Créer l'identifiant OAuth

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Type : **Web application**.
3. **Authorized redirect URIs** : collez l'URL affichée dans GEDify
   (Messagerie → Paramètres des emails → « Synchroniser l'agenda et les contacts
   Google »), de la forme :
   ```
   https://VOTRE-INSTANCE/api/connectors/gmail/callback
   ```
   (HTTPS obligatoire ; doit correspondre **exactement**, sans `/` final.)
4. Notez le **Client ID** et le **Client secret**.

## 4. Renseigner GEDify (`.env.local`)

```
GOOGLE_CLIENT_ID=<votre-client-id>
GOOGLE_CLIENT_SECRET=<votre-client-secret>
GOOGLE_REDIRECT_URI=https://VOTRE-INSTANCE/api/connectors/gmail/callback
GOOGLE_OAUTH_STATE_SECRET=<aléatoire long>     # ou CONNECTOR_SECRET_KEY
CONNECTOR_SECRET_KEY=<16+ caractères>          # chiffrement des tokens
GEDIFY_PUBLIC_URL=https://VOTRE-INSTANCE

# Scopes RÉDUITS : agenda + contacts, SANS Gmail (l'email passe par IMAP)
GOOGLE_GMAIL_SCOPES=https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/contacts.readonly
```

Redémarrez le conteneur (le `.env.local` est lu au démarrage).

## 5. Connecter

Messagerie → Paramètres des emails → **Ajouter une boîte → Continuer avec Google →
« Se connecter avec Google (OAuth) »**, puis consentez. L'agenda et les contacts se
synchronisent ensuite (Agenda, et Messagerie → Contacts).

---

## Bon à savoir

- **Refresh tokens en mode « Testing »** : tant que l'écran de consentement est en
  *Testing*, Google fait expirer le refresh token au bout de **7 jours** → il faut
  reconnecter. Pour des jetons longue durée, passez l'app **« In production »**
  (les scopes Calendar/Contacts étant *sensibles*, Google demande une vérification
  de marque — quelques jours, sans audit CASA).
- **Email vs agenda/contacts** : avec les scopes réduits ci-dessus, la connexion
  Google ne donne **pas** accès aux emails (c'est voulu). Gardez l'email sur la
  boîte IMAP « mot de passe d'application ».
- **HTTPS + domaine** obligatoires pour le redirect URI (pas d'IP, pas de
  `http://`, sauf `localhost`).
