# Chiffrement au repos par tenant

Chiffrement des fichiers stockés sur disque, **par tenant**, en architecture
d'enveloppe (envelope encryption). Conçu pour être **rétrocompatible** : les
installations sans clé maître (local, Synology, mono-tenant) ne sont pas
affectées, et les fichiers existants en clair restent lisibles.

## Principe

```
ENCRYPTION_MASTER_KEY (KEK, env)  ──chiffre──▶  DEK par tenant (en base, wrappée)
DEK (en clair, en mémoire serveur) ──chiffre──▶ fichiers (originals, miniatures,
                                                aperçus, pages, factures PDF/HTML)
```

- **KEK** (Key Encryption Key) : clé maître de 32 octets, lue **uniquement**
  depuis `ENCRYPTION_MASTER_KEY`. Jamais en base, jamais loggée, jamais exposée.
- **DEK** (Data Encryption Key) : une clé aléatoire de 32 octets **par tenant**,
  stockée en base **chiffrée par la KEK** (table `tenant_encryption_keys`,
  colonne `wrapped_dek`). Jamais stockée en clair.
- **Fichiers** : chiffrés en AES-256-GCM avec la DEK du tenant. Un en-tête
  d'enveloppe autoportant (`GEDENC…`) contient l'identifiant de tenant, ce qui
  permet de retrouver la bonne clé au déchiffrement. Le tenantId est aussi lié en
  AAD (anti-rejeu inter-tenant).

## Configuration

```bash
# Générer une clé maître (à conserver précieusement, hors base) :
openssl rand -base64 32

# Variable d'environnement (Coolify) :
ENCRYPTION_MASTER_KEY=<la_clé_base64>
```

Sans cette variable, le chiffrement est **inactif** : les fichiers sont écrits en
clair (comportement historique). Formats acceptés : base64 (32 octets) ou hex
(64 caractères).

> ⚠️ **Ne perdez jamais la KEK.** Si elle est perdue ou modifiée, les DEK ne
> peuvent plus être déwrappées et **tous les fichiers chiffrés deviennent
> illisibles**. Sauvegardez-la dans un coffre (gestionnaire de secrets).

## Ce qui est chiffré

| Donnée | Chiffrée |
|---|---|
| Fichiers originaux des documents | ✅ |
| Miniatures / aperçus / pages rendues | ✅ |
| Factures PDF / HTML | ✅ |
| OCR / texte extrait | ⏳ (prévu, point d'extension) |

Le chiffrement/déchiffrement est **transparent** : il est branché dans la couche
de stockage (`engine/stores`). L'OCR, l'IA, les miniatures et les téléchargements
continuent de fonctionner côté serveur : ils lisent via les fonctions de
stockage, qui déchiffrent automatiquement (déchiffrement **uniquement** lors
d'une lecture autorisée côté serveur).

## Cycle de vie des clés

- À la **création d'un tenant**, sa clé est générée automatiquement si une KEK
  est configurée.
- Pour les tenants existants : page **Gestion clients → Chiffrement →
  « Générer les clés manquantes »**, ou au premier écrit (création paresseuse).
- La page affiche l'état **sans aucun secret** (présence/validité de la KEK,
  couverture des clés par tenant).

## Rétrocompatibilité & bascule

- **Fichiers existants** (écrits avant l'activation) : restent en clair et sont
  lus tels quels (détection par l'en-tête d'enveloppe). Aucune migration n'est
  obligatoire ; le chiffrement s'applique aux **nouveaux** écrits.
- Régénérer les dérivés (miniatures/aperçus) via les outils de maintenance
  réécrit ces fichiers chiffrés.

## Vérification

```bash
npm run saas:check-encryption
```

Le script (lecture seule, sans secret) vérifie la présence/validité de la KEK,
la couverture des clés tenant, et que **chaque DEK stockée se déwrappe avec la
KEK courante** — ce qui détecte immédiatement une KEK erronée ou modifiée.

## Tables

`tenant_encryption_keys (id, tenant_id unique, wrapped_dek, algo, key_version,
status, …)` — appliquer le schéma avec `npm run db:push` après déploiement.
