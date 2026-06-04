#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DATA="${GEDIFY_DATA_DIR:?GEDIFY_DATA_DIR manquant}"
cd "$HERE"
[ -f .env ] || { echo "[start] .env absent — lancez d'abord install-local-stack.sh"; exit 1; }
echo "[start] Démarrage du stack Paperless local…"
GEDIFY_DATA_DIR="$DATA" docker compose -f docker-compose.paperless.yml up -d
echo "[start] Paperless : http://localhost:8010 (peut prendre 1-2 min au premier lancement)"
