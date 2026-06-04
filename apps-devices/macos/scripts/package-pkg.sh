#!/usr/bin/env bash
# Génère Gedify.pkg (et .dmg) via electron-builder. Exécuter sur un Mac.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules ] || npm install
[ -f electron/assets/Gedify.icns ] || { echo "[pkg] Icône manquante → génération…"; bash scripts/make-icns.sh || echo "[pkg] (icône optionnelle ignorée)"; }
npm run build:electron
npx electron-builder --mac pkg
echo "[pkg] Résultat dans ./dist/ (Gedify-<version>.pkg)."
