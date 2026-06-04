#!/usr/bin/env bash
# Génère electron/assets/Gedify.icns à partir d'un PNG carré (>= 512px).
# Source par défaut : l'icône Gedify du projet web (public/gedify-icon.png).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${1:-../../public/gedify-icon.png}"
[ -f "$SRC" ] || SRC="../../public/gedify-marque/gedify-icon.png"
[ -f "$SRC" ] || { echo "[icns] PNG source introuvable ($SRC). Passez le chemin en argument."; exit 1; }

TMP="$(mktemp -d)/Gedify.iconset"; mkdir -p "$TMP"
for s in 16 32 64 128 256 512; do
  sips -z $s $s "$SRC" --out "$TMP/icon_${s}x${s}.png" >/dev/null
  d=$((s*2)); sips -z $d $d "$SRC" --out "$TMP/icon_${s}x${s}@2x.png" >/dev/null
done
mkdir -p electron/assets
iconutil -c icns "$TMP" -o electron/assets/Gedify.icns
echo "[icns] electron/assets/Gedify.icns généré depuis $SRC."
