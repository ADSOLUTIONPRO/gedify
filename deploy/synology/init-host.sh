#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Gedify — Initialisation HÔTE Synology (À LANCER AVANT Container Manager).
#
# Container Manager / docker compose lit `env_file` AU PARSING : si
# onlyoffice.env n'existe pas, la création du projet échoue (« Failed to load
# …/onlyoffice.env: no such file or directory ») AVANT qu'aucun conteneur ne
# puisse le créer. Ce script crée donc, côté hôte, les dossiers + les fichiers
# d'environnement nécessaires, de façon idempotente et sécurisée.
#
# Usage :
#   export SYNOLOGY_DOCKER_ROOT=/volume1/docker/gedify   # ou /volume5/...
#   sh deploy/synology/init-host.sh
#
# Rotation volontaire de la clé ONLYOFFICE (si compromise) :
#   FORCE_ROTATE_ONLYOFFICE_SECRET=1 sh deploy/synology/init-host.sh
#
# Sécurité : la clé JWT n'est JAMAIS affichée en clair ; fichiers en chmod 600 ;
# jamais committés (cf. .gitignore). Une clé existante n'est jamais écrasée
# (sauf FORCE_ROTATE_ONLYOFFICE_SECRET=1).
# ─────────────────────────────────────────────────────────────────────────────
set -eu

# Racine configurable (défaut volume1). Exemple volume5 :
#   export SYNOLOGY_DOCKER_ROOT=/volume5/docker/gedify
ROOT="${SYNOLOGY_DOCKER_ROOT:-/volume1/docker/gedify}"
DATA_DIR="$ROOT/data"
SECRETS_FILE="$DATA_DIR/secrets.env"
ONLYOFFICE_ENV_FILE="$DATA_DIR/onlyoffice.env"
FORCE_ROTATE="${FORCE_ROTATE_ONLYOFFICE_SECRET:-0}"

echo "Création des dossiers Synology GEDify… (racine : $ROOT)"
for d in \
  "$DATA_DIR" \
  "$ROOT/onlyoffice/logs" \
  "$ROOT/onlyoffice/data" \
  "$ROOT/onlyoffice/lib" \
  "$ROOT/onlyoffice/db" \
  "$ROOT/ollama"
do
  mkdir -p "$d"
done

# 32 octets aléatoires en hexadécimal. openssl si présent, sinon /dev/urandom.
gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    tr -dc 'a-f0-9' < /dev/urandom 2>/dev/null | head -c 64
  fi
}

# Lit la valeur d'une clé dans un fichier env (vide si absente).
read_env() { # $1=fichier $2=clé
  [ -f "$1" ] || return 0
  grep -E "^$2=" "$1" 2>/dev/null | head -n1 | cut -d= -f2-
}

# ── Détermine LA clé ONLYOFFICE partagée (GEDify ⇄ ONLYOFFICE) ────────────────
# Priorité : valeur déjà dans onlyoffice.env, sinon dans secrets.env, sinon neuve.
OO_KEY="$(read_env "$ONLYOFFICE_ENV_FILE" ONLYOFFICE_JWT_SECRET)"
[ -n "$OO_KEY" ] || OO_KEY="$(read_env "$SECRETS_FILE" ONLYOFFICE_JWT_SECRET)"

if [ "$FORCE_ROTATE" = "1" ]; then
  OO_KEY="$(gen_secret)"
  echo "⚠️  FORCE_ROTATE_ONLYOFFICE_SECRET=1 : génération d'une NOUVELLE clé ONLYOFFICE."
elif [ -z "$OO_KEY" ]; then
  OO_KEY="$(gen_secret)"
fi

# ── onlyoffice.env (lu par le conteneur ONLYOFFICE via env_file) ──────────────
if [ -f "$ONLYOFFICE_ENV_FILE" ] && [ "$FORCE_ROTATE" != "1" ]; then
  echo "onlyoffice.env existe déjà, conservation de la clé existante."
else
  echo "Création de onlyoffice.env…"
  ( umask 177
    cat > "$ONLYOFFICE_ENV_FILE" <<EOF
ONLYOFFICE_JWT_SECRET=$OO_KEY
JWT_SECRET=$OO_KEY
JWT_ENABLED=true
JWT_HEADER=Authorization
EOF
  )
  chmod 600 "$ONLYOFFICE_ENV_FILE"
fi

# ── secrets.env (lu par GEDify) ───────────────────────────────────────────────
# Secrets internes générés si absents (jamais écrasés). ONLYOFFICE_JWT_SECRET est
# forcé à la MÊME valeur que onlyoffice.env (les deux doivent rester identiques).
[ -f "$SECRETS_FILE" ] || ( umask 177; : > "$SECRETS_FILE" )

set_env() { # $1=clé $2=valeur (remplace ou ajoute)
  tmp="$SECRETS_FILE.tmp.$$"
  ( grep -v -E "^$1=" "$SECRETS_FILE" 2>/dev/null || true ) > "$tmp"
  printf '%s=%s\n' "$1" "$2" >> "$tmp"
  cat "$tmp" > "$SECRETS_FILE"
  rm -f "$tmp"
}

ensure_secret() { # $1=clé : ajoute une valeur aléatoire seulement si absente
  cur="$(read_env "$SECRETS_FILE" "$1")"
  [ -n "$cur" ] || set_env "$1" "$(gen_secret)"
}

for s in AUTH_SECRET JWT_SECRET SESSION_SECRET ENCRYPTION_KEY INTERNAL_API_KEY CRON_SECRET; do
  ensure_secret "$s"
done
# Synchronise la clé ONLYOFFICE (peut « remplacer » une valeur désynchronisée,
# c'est voulu : GEDify et ONLYOFFICE doivent partager exactement la même clé).
if [ "$(read_env "$SECRETS_FILE" ONLYOFFICE_JWT_SECRET)" != "$OO_KEY" ]; then
  set_env ONLYOFFICE_JWT_SECRET "$OO_KEY"
fi
chmod 600 "$SECRETS_FILE"

# ── .env pour Container Manager (interpolation des chemins du compose) ─────────
# Pointeur de chemin (PAS un secret) : fixe SYNOLOGY_DOCKER_ROOT à côté du compose
# pour que les volumes/env_file résolvent le bon volume sans réglage manuel.
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
COMPOSE_ENV="$SCRIPT_DIR/.env"
{
  ( grep -v -E "^SYNOLOGY_DOCKER_ROOT=" "$COMPOSE_ENV" 2>/dev/null || true )
  printf 'SYNOLOGY_DOCKER_ROOT=%s\n' "$ROOT"
} > "$COMPOSE_ENV.tmp.$$" 2>/dev/null && mv "$COMPOSE_ENV.tmp.$$" "$COMPOSE_ENV" 2>/dev/null \
  && echo "Pointeur de chemin écrit : $COMPOSE_ENV (SYNOLOGY_DOCKER_ROOT=$ROOT)" \
  || echo "Note : impossible d'écrire $COMPOSE_ENV — réglez SYNOLOGY_DOCKER_ROOT dans Container Manager."

if [ "$FORCE_ROTATE" = "1" ]; then
  echo "⚠️  Clé ONLYOFFICE renouvelée : REDÉMARREZ les conteneurs 'gedify' ET 'gedify-onlyoffice'."
fi
echo "Initialisation Synology terminée."
