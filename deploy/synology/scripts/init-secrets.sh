#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Génère les secrets internes Gedify (déploiement Synology SQLite) UNE SEULE FOIS.
#
# Idempotent : un secret déjà présent dans secrets.env n'est JAMAIS réécrit.
# Aucune VRAIE clé externe n'est générée ici (notamment JAMAIS OPENAI_API_KEY).
# Le fichier est créé en 0600 (lisible par le seul utilisateur applicatif) et ne
# doit jamais être committé (cf. .gitignore : .data/ est ignoré).
# ─────────────────────────────────────────────────────────────────────────────
set -eu

DATA_DIR="${DATA_DIR:-/app/.data}"
SECRETS_FILE="$DATA_DIR/secrets.env"
# Fichier dédié au conteneur ONLYOFFICE : ne contient QUE JWT_SECRET (= la valeur
# de ONLYOFFICE_JWT_SECRET). ONLYOFFICE ne voit donc aucun autre secret interne.
ONLYOFFICE_ENV_FILE="$DATA_DIR/onlyoffice.env"

mkdir -p "$DATA_DIR"

# Crée le fichier vide en 0600 s'il n'existe pas (umask 177 → rw-------).
if [ ! -f "$SECRETS_FILE" ]; then
  ( umask 177; : > "$SECRETS_FILE" )
fi

# Génère 32 octets aléatoires en hexadécimal. openssl, sinon Node, sinon /dev/urandom
# (repli portable busybox → fonctionne même dans une image alpine nue).
gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  elif command -v node >/dev/null 2>&1; then
    node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
  else
    tr -dc 'a-f0-9' < /dev/urandom 2>/dev/null | head -c 64
  fi
}

# Ajoute le secret seulement s'il est absent ou vide. Ne réécrit jamais.
ensure_secret() {
  name="$1"
  if grep -qE "^${name}=.+" "$SECRETS_FILE" 2>/dev/null; then
    return 0
  fi
  value="$(gen_secret)"
  printf '%s=%s\n' "$name" "$value" >> "$SECRETS_FILE"
}

# Secrets internes Gedify (auth + chiffrement applicatif) + clé ONLYOFFICE.
# ONLYOFFICE_JWT_SECRET signe/valide les tokens entre Gedify et ONLYOFFICE :
# la MÊME valeur est utilisée des deux côtés. AUCUNE clé externe (jamais OPENAI).
for s in \
  AUTH_SECRET \
  JWT_SECRET \
  SESSION_SECRET \
  ENCRYPTION_KEY \
  INTERNAL_API_KEY \
  CRON_SECRET \
  CONNECTOR_SECRET_KEY \
  MAIL_CONNECTOR_KEY \
  ONLYOFFICE_JWT_SECRET
do
  ensure_secret "$s"
done

# Verrouille les permissions (au cas où le fichier préexistait en 0644).
chmod 600 "$SECRETS_FILE"

# Dérive le fichier ONLYOFFICE pour le conteneur onlyoffice (env_file). Sur
# Synology, ce fichier est normalement déjà créé côté hôte par init-host.sh
# (AVANT l'import Container Manager) : on ne l'écrit donc QUE s'il est absent,
# pour ne jamais écraser une clé existante. Format identique à init-host.sh.
# Ne révèle jamais la clé dans les logs.
oo_secret="$(grep -E '^ONLYOFFICE_JWT_SECRET=' "$SECRETS_FILE" | head -n1 | cut -d= -f2-)"
if [ -n "${oo_secret:-}" ] && [ ! -f "$ONLYOFFICE_ENV_FILE" ]; then
  ( umask 177
    cat > "$ONLYOFFICE_ENV_FILE" <<EOF
ONLYOFFICE_JWT_SECRET=$oo_secret
JWT_SECRET=$oo_secret
JWT_ENABLED=true
JWT_HEADER=Authorization
EOF
  )
  chmod 600 "$ONLYOFFICE_ENV_FILE"
fi

echo "[init-secrets] Secrets internes GEDify prêts (dont ONLYOFFICE_JWT_SECRET)."
