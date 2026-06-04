#!/usr/bin/env bash
# Compile le process Electron (TypeScript → dist-electron).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules ] || npm install
npm run build:electron
echo "[build] dist-electron prêt."
