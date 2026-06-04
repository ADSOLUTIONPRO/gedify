#!/usr/bin/env bash
# Prépare le stack Paperless local : crée les dossiers, génère .env + secrets, pré-télécharge les images.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DATA="${GEDIFY_DATA_DIR:?GEDIFY_DATA_DIR manquant}"

echo "[install] Dossier de données : $DATA"
mkdir -p "$DATA"/{redis,postgres,paperless/data,paperless/media,paperless/export,paperless/consume}

ENV="$HERE/.env"
if [ ! -f "$ENV" ]; then
  echo "[install] Génération de $ENV (avec secrets)"
  gen() { LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "${1:-40}"; }
  sed \
    -e "s/^PAPERLESS_DBPASS=.*/PAPERLESS_DBPASS=$(gen 32)/" \
    -e "s/^PAPERLESS_SECRET_KEY=.*/PAPERLESS_SECRET_KEY=$(gen 50)/" \
    -e "s/^PAPERLESS_ADMIN_PASSWORD=.*/PAPERLESS_ADMIN_PASSWORD=$(gen 24)/" \
    "$HERE/.env.example" > "$ENV"
else
  echo "[install] $ENV existe déjà — conservé."
fi

echo "[install] Pré-téléchargement des images Docker (peut être long)…"
cd "$HERE"
GEDIFY_DATA_DIR="$DATA" docker compose -f docker-compose.paperless.yml pull
echo "[install] Terminé."
