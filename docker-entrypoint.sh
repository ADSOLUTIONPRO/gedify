#!/bin/sh
# Démarre en root : garantit que le répertoire de données persistant (volume
# Coolify, souvent monté en root) est inscriptible par l'utilisateur applicatif,
# puis abandonne les privilèges pour lancer l'app en `nextjs`.
set -e

DATA_DIR="${DATA_DIR:-/app/.data}"

# GARDE-FOU : ne JAMAIS chown -R un chemin système. Si le volume persistant est
# (mal) monté sur un répertoire hôte comme /root, /home, /etc…, un chown récursif
# détruirait les permissions de l'hôte (ex. clés SSH de root → déploiements KO).
# On refuse alors le chown et on laisse l'app tenter d'écrire telle quelle.
case ":$DATA_DIR:" in
  ":/:"|":/root:"|":/home:"|":/etc:"|":/var:"|":/usr:"|":/bin:"|":/sbin:"|":/lib:"|":/lib64:"|":/boot:"|":/dev:"|":/proc:"|":/sys:"|":/run:"|":/app:")
    echo "[entrypoint] DANGER : DATA_DIR=$DATA_DIR est un chemin système — chown ignoré."
    echo "[entrypoint] Montez un volume dédié (volume Docker nommé ou /data/...:/app/.data), pas un répertoire hôte sensible."
    exec su-exec nextjs:nodejs "$@"
    ;;
esac

mkdir -p "$DATA_DIR"

if chown -R nextjs:nodejs "$DATA_DIR" 2>/dev/null; then
  echo "[entrypoint] $DATA_DIR rendu inscriptible par nextjs (uid 1001)."
else
  echo "[entrypoint] AVERTISSEMENT : chown $DATA_DIR impossible — vérifiez les permissions du volume."
fi

exec su-exec nextjs:nodejs "$@"
