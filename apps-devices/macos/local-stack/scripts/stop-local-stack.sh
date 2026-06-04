#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"
echo "[stop] Arrêt du stack Paperless local…"
GEDIFY_DATA_DIR="${GEDIFY_DATA_DIR:-}" docker compose -f docker-compose.paperless.yml stop
echo "[stop] Arrêté (les données sont conservées)."
