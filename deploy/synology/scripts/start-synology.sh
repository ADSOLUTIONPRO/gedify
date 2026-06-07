#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Démarrage Gedify pour Synology (SQLite + Ollama local).
# Ordre :
#   1. générer/charger les secrets internes (init-secrets.sh, idempotent) ;
#   2. exporter les secrets dans l'environnement ;
#   3. lancer le serveur Next.js standalone.
#
# Ce script est appelé par `command:` dans docker-compose.sqlite.v2.yml, APRÈS que
# l'entrypoint a rendu DATA_DIR inscriptible et abandonné les privilèges root.
# Il ne concerne QUE la version Synology — les autres images gardent `node server.js`.
# ─────────────────────────────────────────────────────────────────────────────
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="${DATA_DIR:-/app/.data}"
SECRETS_FILE="$DATA_DIR/secrets.env"

# 1. Générer les secrets manquants (jamais d'écrasement).
"$SCRIPT_DIR/init-secrets.sh"

# 2. Charger secrets.env dans l'environnement (les secrets générés priment sur
#    d'éventuelles valeurs placeholder héritées du compose).
if [ -f "$SECRETS_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$SECRETS_FILE"
  set +a
fi

# Diagnostic NON sensible : présence des secrets clés (jamais la valeur).
[ -n "${AUTH_SECRET:-}" ]    && echo "[start] AUTH_SECRET loaded=true"    || echo "[start] AUTH_SECRET loaded=false"
[ -n "${SESSION_SECRET:-}" ] && echo "[start] SESSION_SECRET loaded=true" || echo "[start] SESSION_SECRET loaded=false"
echo "[start] DATA_DIR=${DATA_DIR}  DATABASE_URL set=$([ -n "${DATABASE_URL:-}" ] && echo true || echo false)  mode=${GEDIFY_STORAGE_MODE:-json}"

# 3. Démarrer l'app (server.js standalone à la racine /app).
cd /app
exec node server.js
