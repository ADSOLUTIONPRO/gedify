# Sécurité & Déploiement — GED AzServer

## Architecture de sécurité

```
Internet → Coolify/Traefik (TLS + Basic Auth optionnel)
          → doc.azserver.fr  (surcouche GED, auth applicative)
          → ged.azserver.fr  (Paperless, non exposé publiquement)
```

---

## 1. Authentification applicative

### Variables d'environnement requises

```env
AUTH_SECRET=<32+ caractères aléatoires>
ADMIN_EMAIL=vous@exemple.fr
ADMIN_PASSWORD_HASH=<hash généré par npm run hash-password>
SESSION_COOKIE_NAME=gedazserver.session
SESSION_MAX_AGE_SECONDS=28800
```

### Générer AUTH_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Générer le hash du mot de passe admin

```bash
npm run hash-password -- "VotreMotDePasseUltraFort!"
```

Copiez la valeur affichée dans `ADMIN_PASSWORD_HASH`.

Le hash utilise **scrypt** (Node.js natif) avec sel aléatoire 128 bits.
Le mot de passe en clair n'est jamais stocké ni loggué.

### Flux de session

- JWT HS256 signé avec `AUTH_SECRET`, stocké dans un cookie `httpOnly; Secure; SameSite=Lax`
- Expiration configurable via `SESSION_MAX_AGE_SECONDS` (défaut 8 h)
- Le middleware vérifie le JWT sur chaque requête — aucune donnée n'est accessible sans session valide

---

## 2. Middleware de protection

`middleware.ts` protège l'ensemble des routes :

- Routes publiques : `/login`, `/api/auth/*`, `/_next/*`, `/favicon*`
- Toutes les autres pages → redirect `/login?next=<pathname>` si non authentifié
- Toutes les routes `/api/*` → `401 JSON` si non authentifié

---

## 3. Basic Auth Coolify (protection supplémentaire temporaire)

Utile pendant la phase de test pour ajouter un deuxième verrou devant l'application **avant** le login applicatif. Ne remplace pas l'auth applicative.

### Générer un hash htpasswd

```bash
# Avec htpasswd (apache2-utils)
htpasswd -nB admin
# Ou avec openssl
echo "admin:$(openssl passwd -apr1 'motdepasse')"
```

### Configurer dans Coolify

1. Dans Coolify → votre service → **Proxy** → **Basic Auth**
2. Ajouter la ligne `admin:$apr1$...` générée ci-dessus
3. Appliquer — Traefik recharge automatiquement

### Retirer la Basic Auth une fois en production

Une fois l'auth applicative en place et testée, désactivez la Basic Auth Coolify pour ne pas bloquer les flux automatiques (webhooks, imports API, etc.).

---

## 4. Secrets à ne jamais exposer côté client

| Variable | Risque |
|---|---|
| `PAPERLESS_TOKEN` | Accès total à Paperless |
| `OPENAI_API_KEY` | Facturation OpenAI |
| `AUTH_SECRET` | Forge de sessions |
| `ADMIN_PASSWORD_HASH` | Hash du mot de passe admin |
| `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `CONNECTOR_SECRET_KEY` | Déchiffrement des tokens Gmail |

Toutes ces variables sont utilisées **uniquement côté serveur** dans `src/lib/`. Aucun `NEXT_PUBLIC_` pour ces valeurs.

---

## 5. Headers de sécurité HTTP

Définis dans `next.config.ts` :

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` — autorise `office.azserver.fr` en iframe pour OnlyOffice

---

## 6. Checklist avant première utilisation en production

- [ ] `AUTH_SECRET` renseigné (32+ caractères)
- [ ] `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` renseignés
- [ ] `PAPERLESS_TOKEN` renseigné (et jamais public)
- [ ] HTTPS actif sur `doc.azserver.fr` (Coolify/Let's Encrypt)
- [ ] Cookie `Secure` actif (`NODE_ENV=production`)
- [ ] Paperless (`ged.azserver.fr`) non exposé publiquement
- [ ] Basic Auth Coolify activée pendant les tests (optionnel)
