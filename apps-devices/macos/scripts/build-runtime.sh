#!/usr/bin/env bash
# Construit le moteur Gedify local (Next.js standalone) et le bundle, allégé,
# dans apps-devices/macos/gedify-runtime/ pour qu'Electron le lance en local (:3120).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
OUT="$ROOT/apps-devices/macos/gedify-runtime"

echo "[runtime] build Next.js standalone (next build)…"
cd "$ROOT"
npm run build

echo "[runtime] assemblage dans $OUT"
rm -rf "$OUT"
mkdir -p "$OUT/.next"
cp -R "$ROOT/.next/standalone/." "$OUT/"
cp -R "$ROOT/.next/static" "$OUT/.next/static"

# public : seulement le nécessaire au runtime (pas les maquettes), sans imbrication
rm -rf "$OUT/public"
mkdir -p "$OUT/public"
rsync -a --exclude 'design-reference/' --exclude 'refontedesign/' --exclude 'public/' \
  "$ROOT/public/" "$OUT/public/"

# Nettoyage : sources & sous-projets inutiles au runtime (le serveur compilé est dans .next/server).
rm -rf "$OUT/apps-devices" "$OUT/src" "$OUT/docs" "$OUT/scripts" "$OUT/.git" \
       "$OUT"/README* "$OUT"/tsconfig* "$OUT/package-lock.json" "$OUT/.eslintcache" \
       "$OUT/eslint.config.mjs" "$OUT/Dockerfile" "$OUT/.dockerignore" "$OUT/docker-entrypoint.sh"

# Binaires sharp arm64 + x64 (pkgs fonctionnels sur les deux puces, build depuis l'une ou l'autre).
SHARPVER=$(node -p "require('$ROOT/node_modules/sharp/package.json').version" 2>/dev/null || true)
add_sharp() {
  arch="$1"
  [ -d "$OUT/node_modules/@img/sharp-darwin-$arch" ] && return 0
  echo "[runtime] ajout sharp darwin-$arch"
  t=$(mktemp -d)
  ( cd "$t" && npm init -y >/dev/null 2>&1 && npm install --no-audit --no-fund --os=darwin --cpu="$arch" "sharp@$SHARPVER" >/dev/null 2>&1 ) || true
  cp -R "$t/node_modules/@img/sharp-darwin-$arch" "$t/node_modules/@img/sharp-libvips-darwin-$arch" "$OUT/node_modules/@img/" 2>/dev/null || true
  rm -rf "$t"
}
if [ -n "${SHARPVER:-}" ] && [ -d "$OUT/node_modules/@img" ]; then
  add_sharp x64
  add_sharp arm64
fi

echo "[runtime] OK → $OUT/server.js"
du -sh "$OUT"
