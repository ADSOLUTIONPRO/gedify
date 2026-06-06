#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Démarrage Gedify pour Synology (SQLite + Ollama local).
# Ordre :
#   1. générer/charger les secrets internes (init-secrets.sh, idempotent) ;
#   2. exporter les secrets dans l'environnement ;
#   3. lancer le serveur Next.js standalone.
#
# Ce script est appelé par `command:` dans docker-compose.sqlite.yml, APRÈS que
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

# 3. Démarrer l'app (server.js standalone à la racine /app).
cd /app
exec node server.js
