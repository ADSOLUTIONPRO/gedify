# Gedify autonome (sans Paperless) — `nopp`

Variante **100 % autonome** de Gedify : aucun serveur Paperless requis. Le moteur
documentaire (stockage des fichiers, extraction de texte / OCR, miniatures,
recherche plein-texte, taxonomies, corbeille, utilisateurs) est **embarqué** et
remplace, à signature identique, le client `src/lib/paperless.ts` de l'app
d'origine. Le reste de l'interface Gedify est inchangé.

> Cette copie est **isolée** de l'app principale (`apps-devices/` est exclu du
> build/tsconfig/eslint/Docker de la racine). On peut donc la faire évoluer sans
> impacter le déploiement en ligne.

## Lancer en local

```bash
cd apps-devices/nopp
npm install        # installe aussi tesseract.js, @napi-rs/canvas, minisearch…
npm run dev        # http://localhost:3200
```

- **Données & médias** : tout est persisté dans `apps-devices/nopp/.data/`
  (stores JSON sous `.data/engine/`, fichiers sous `.data/media/`). Surchargé via
  `DATA_DIR=/chemin/absolu`.
- **Admin au 1ᵉʳ lancement** — deux voies :
  1. **Écran `/installation`** (par défaut) : au premier accès avec un store
     vide, l'app affiche l'écran de première connexion pour créer le compte
     administrateur, persisté dans le store et utilisable ensuite sur la page de
     connexion.
  2. **Amorçage par environnement** (recommandé si le volume peut être recréé,
     ex. Synology) : définir `GEDIFY_ADMIN_USER` + `GEDIFY_ADMIN_PASSWORD`
     (optionnel `GEDIFY_ADMIN_MAIL`). L'admin est (re)créé automatiquement si le
     store est vide. `GEDIFY_ADMIN_RESET=true` force la réinitialisation du mot de
     passe d'un compte existant qui ne correspond plus (récupération après une
     bascule de backend ou un volume recréé).
  - Mode sans authentification (poste local uniquement) : `GEDIFY_LOCAL_NO_AUTH=1`.
  - Déploiement **HTTP** (sans TLS, ex. NAS sur LAN) : `COOKIE_SECURE=false`,
    sinon le navigateur rejette le cookie de session (boucle sur `/login`).
  - `AUTH_SECRET` doit être **fixe et persistant** : si elle change à chaque
    recréation du conteneur, toutes les sessions sont invalidées (déconnexions).

## Architecture du moteur (`src/lib/engine/`)

| Fichier | Rôle |
|---|---|
| `stores.ts` | Stores JSON (documents, tags, correspondents, types, champs perso, chemins, vues, tâches, users) + compteurs d'id + médias |
| `router.ts` | Routeur **Paperless-compatible** : `engineFetch(path, opts)` → mêmes formes de réponse que Paperless |
| `consume.ts` | Ingestion d'un fichier : sauvegarde, texte/OCR, miniature, tâche async |
| `ocr.ts` | Extraction de texte (pdfjs) + OCR de secours (Tesseract.js fra+eng) |
| `thumbnails.ts` | Miniatures (sharp ; PDF rendu via pdfjs + @napi-rs/canvas) |
| `search.ts` | Index plein-texte minisearch |
| `users.ts` | Utilisateurs locaux (bcrypt) + bootstrap admin |
| `status.ts` | État synthétique « moteur OK » (remplace `/api/status/`, `/api/statistics/`…) |

Le câblage se fait dans `src/lib/paperless.ts` (réécrit en shim → moteur) et les
3 routes binaires `src/app/api/paperless/documents/[id]/{thumb,preview,download}`.

## Réserves connues
- Conversion **Office → PDF** (docx/xlsx) non incluse (pur JS) : l'aperçu Office
  retombe sur le téléchargement.
- OCR Tesseract.js lent sur gros scans → ingestion **asynchrone** (file d'attente).
