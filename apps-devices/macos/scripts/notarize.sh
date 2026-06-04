#!/usr/bin/env bash
# Notarisation Apple du .pkg (optionnelle, nécessite un compte développeur Apple).
# Renseignez : APPLE_ID, APPLE_TEAM_ID, APPLE_APP_SPECIFIC_PASSWORD.
set -euo pipefail
cd "$(dirname "$0")/.."
PKG="$(ls -t dist/*.pkg 2>/dev/null | head -1 || true)"
[ -n "$PKG" ] || { echo "[notarize] Aucun .pkg dans dist/ — lancez d'abord scripts/package-pkg.sh"; exit 1; }
: "${APPLE_ID:?APPLE_ID manquant}" "${APPLE_TEAM_ID:?APPLE_TEAM_ID manquant}" "${APPLE_APP_SPECIFIC_PASSWORD:?mot de passe app-specific manquant}"

echo "[notarize] Soumission de $PKG…"
xcrun notarytool submit "$PKG" \
  --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --wait
xcrun stapler staple "$PKG"
echo "[notarize] Terminé."
