# Installer ONLYOFFICE Docs avec GED AzServer

Cette surcouche intègre un éditeur de texte en ligne (ONLYOFFICE Docs) pour rédiger des
courriers, modifier des fichiers DOCX et exporter en PDF directement vers Paperless. ONLYOFFICE
tourne dans un **service séparé** (autre conteneur Coolify) ; cette application l'embarque via son
script `api.js` et son API d'intégration.

## 1. Pré-requis

- Coolify opérationnel.
- Domaine HTTPS dédié, par exemple `https://office.azserver.fr`.
- Cette surcouche déployée et accessible publiquement (ONLYOFFICE doit pouvoir appeler ses URLs
  callback et fichier).
- Paperless distant déjà configuré (`PAPERLESS_URL`, `PAPERLESS_TOKEN`).

## 2. Déployer ONLYOFFICE Docs dans Coolify

1. Dans Coolify, **New Resource → Application → Docker image**.
2. Image : `onlyoffice/documentserver:latest` (variante community, libre).
3. Volumes recommandés :
   - `/var/log/onlyoffice` (logs)
   - `/var/lib/onlyoffice` (cache, données)
4. Variables d'environnement :
   - `JWT_ENABLED=true`
   - `JWT_SECRET=<long secret aléatoire identique à ONLYOFFICE_JWT_SECRET côté GED AzServer>`
   - `JWT_HEADER=Authorization`
   - `JWT_IN_BODY=true`
   - `USE_UNAUTHORIZED_STORAGE=false` (HTTPS partout)
5. Port à exposer : `80` (l'image écoute en HTTP, Coolify met du TLS devant).
6. Domaine : `office.azserver.fr` avec Let's Encrypt activé.
7. Healthcheck (optionnel) : `GET /healthcheck`.

> ⚠️ **HTTPS obligatoire** : ONLYOFFICE refuse les iframes sur des contextes mixtes (HTTPS ↔ HTTP).

## 3. Variables d'environnement côté GED AzServer

Ajoutez dans Coolify (service de la surcouche) :

```env
ONLYOFFICE_DOCUMENT_SERVER_URL=https://office.azserver.fr
ONLYOFFICE_JWT_SECRET=<le même secret que côté ONLYOFFICE>
APP_PUBLIC_URL=https://ged.azserver.fr    # URL publique de cette surcouche

# Stockage (par défaut : fichiers JSON locaux dans data/)
WRITER_STORE_TYPE=json
WRITER_STORAGE_PATH=/app/data/writer
SIGNATURE_STORAGE_PATH=/app/data/signatures
```

Le secret JWT doit être **identique** des deux côtés. ONLYOFFICE vérifie chaque requête signée par
la surcouche, et la surcouche vérifie chaque callback signé par ONLYOFFICE.

## 4. Volumes persistants pour la surcouche

Coolify, onglet **Storage** du service GED AzServer :

```
/app/data/writer        → volume persistant (documents DOCX)
/app/data/signatures    → volume persistant (signatures manuscrites)
```

Sans ces volumes, les courriers et signatures disparaîtraient à chaque redémarrage.

## 5. Tester un premier courrier

1. Ouvrir `https://ged.azserver.fr/redaction`.
2. Le statut **« ONLYOFFICE Connecté »** doit s'afficher (sinon revérifier `ONLYOFFICE_DOCUMENT_SERVER_URL`).
3. Cliquer sur **Nouveau courrier** → choisir un type et un modèle → **Créer**.
4. L'éditeur ONLYOFFICE se charge dans la page `/redaction/[id]/modifier`. La sauvegarde est
   automatique via le callback `POST /api/writer/documents/[id]/onlyoffice-callback`.
5. Une fois prêt : **Exporter PDF** ou **Envoyer vers Paperless**.

## 6. Healthcheck et dépannage

| Symptôme                                       | Action                                                       |
| ---------------------------------------------- | ------------------------------------------------------------ |
| "Éditeur ONLYOFFICE indisponible" dans la page | Vérifier que `ONLYOFFICE_DOCUMENT_SERVER_URL` est joignable. |
| "Token validation failed" (logs ONLYOFFICE)    | `ONLYOFFICE_JWT_SECRET` doit être identique des deux côtés.  |
| Callback en erreur (logs surcouche)            | ONLYOFFICE doit pouvoir résoudre `APP_PUBLIC_URL`.          |
| Conversion PDF échoue                          | Vérifier que ONLYOFFICE peut télécharger `/api/writer/documents/<id>/file`. |
| Pas d'OCR sur le document envoyé à Paperless   | C'est Paperless qui OCRise après réception. Vérifier la file Celery. |

## 7. Ce qui marche réellement aujourd'hui

- Création d'un courrier (DOCX généré côté serveur via `docx`).
- Édition en ligne dans ONLYOFFICE (si serveur configuré).
- Sauvegarde automatique côté surcouche via callback (JWT vérifié si secret défini).
- Conversion DOCX → PDF via `ConvertService.ashx` (si ONLYOFFICE joignable).
- Envoi du PDF résultant à Paperless via `/api/documents/post_document/`.

## 8. Ce qui reste à connecter

- **Insertion automatique de la signature** dans le DOCX via l'API ONLYOFFICE — pour l'instant
  manuel via `Insérer → Image` dans l'éditeur.
- **Variables de modèles** (`{{ destinataire }}`, etc.) — les valeurs saisies à la création
  remplissent le DOCX initial, mais la substitution sur des modèles DOCX externes n'est pas encore
  implémentée.
- **Stockage en base** (Postgres/Supabase/S3) — actuellement JSON sur disque.
- **Liaison aux dossiers / projets GED** — champ `projectId` stocké mais non exposé.

## 9. Sécurité

- `ONLYOFFICE_JWT_SECRET` n'est jamais renvoyé au client.
- `PAPERLESS_TOKEN` reste exclusivement côté serveur (`import "server-only"`).
- Les fichiers DOCX sont servis via `/api/writer/documents/[id]/file` (route serveur). Pour
  durcir la sécurité en production : ajouter une signature/URL temporaire de type signed-url.
- Les callbacks ONLYOFFICE sont validés par JWT (HS256) quand `ONLYOFFICE_JWT_SECRET` est défini.
