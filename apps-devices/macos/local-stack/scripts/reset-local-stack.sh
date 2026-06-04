#!/usr/bin/env bash
# Réinitialise le stack. Par défaut : supprime UNIQUEMENT les conteneurs.
# Passez WIPE_DATA=1 pour supprimer AUSSI les données locales (documents inclus) — destructif.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DATA="${GEDIFY_DATA_DIR:?GEDIFY_DATA_DIR manquant}"
cd "$HERE"

echo "[reset] Suppression des conteneurs…"
GEDIFY_DATA_DIR="$DATA" docker compose -f docker-compose.paperless.yml down

if [ "${WIPE_DATA:-0}" = "1" ]; then
  echo "[reset] WIPE_DATA=1 → suppression des données locales (postgres, redis, paperless)…"
  rm -rf "$DATA"/redis "$DATA"/postgres "$DATA"/paperless
  echo "[reset] Données supprimées."
else
  echo "[reset] Données conservées (relancez avec WIPE_DATA=1 pour tout effacer)."
fi
