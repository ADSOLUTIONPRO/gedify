# Installer Gedify sur Mac

## 1. Choisir le bon fichier

| Ton Mac | Fichier à utiliser |
|---|---|
| **Apple Silicon** (M1, M2, M3, M4…) | `Gedify-…-apple-silicon-arm64.pkg` |
| **Intel** (Mac avant ~2021) | `Gedify-…-intel-x64.pkg` |

> Pour savoir : menu  (en haut à gauche) → **À propos de ce Mac** → ligne **Puce** (Apple = Silicon) ou **Processeur** (Intel).

## 2. Installer (clic droit → Ouvrir)

L'app est gratuite et non signée par Apple : il faut juste **autoriser la première ouverture** (une seule fois).

1. **Clic droit** (ou Ctrl + clic) sur le fichier `.pkg` → **Ouvrir**.
2. Une fenêtre demande confirmation → cliquer **Ouvrir**.
3. Suivre l'installeur (il peut demander ton mot de passe Mac) → **Installer**.

> ⚠️ Un simple **double-clic** affichera « développeur non identifié » et bloquera.
> C'est normal : utilise bien **clic droit → Ouvrir** la première fois.

## 3. Lancer Gedify

- Ouvre **Applications → Gedify** (au besoin : clic droit → **Ouvrir** la première fois aussi).
- Au premier lancement, choisis ton mode :
  - **Me connecter à un serveur Gedify existant** — si tu as déjà un serveur Gedify/Paperless en ligne.
  - **Créer Gedify local sur ce Mac** — Gedify en local + ton Paperless existant.
  - **Installer Gedify Local complète** — tout en local (Gedify + Paperless via Docker Desktop).

## Où sont mes données ?

`~/Library/Application Support/Gedify/` — sauvegarde possible depuis **Réglages → Sauvegarde**.

## Désinstaller

Glisser **Applications → Gedify** vers la corbeille. (Tes données restent dans le dossier ci-dessus tant que tu ne les supprimes pas.)
