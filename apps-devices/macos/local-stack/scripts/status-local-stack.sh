#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"
GEDIFY_DATA_DIR="${GEDIFY_DATA_DIR:-}" docker compose -f docker-compose.paperless.yml ps
