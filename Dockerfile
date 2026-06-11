# Gedify autonome (nopp) — SANS Paperless. Image Docker pour Coolify.
# Moteur documentaire local embarqué + OCR hors-ligne (Tesseract fra+eng).

# 1. Dépendances
FROM node:22.13-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
# Étape de BUILD : on FORCE l'installation des devDependencies via --include=dev.
# Coolify expose NODE_ENV=production au build-time → npm appliquerait sinon
# --omit=dev implicitement et n'installerait PAS le toolchain de build
# (tailwindcss, @tailwindcss/postcss, postcss, typescript, prisma, @types/*,
# babel-plugin-react-compiler…) → « Cannot find module '@tailwindcss/postcss' »
# sur globals.css pendant `next build`. --include=dev l'emporte sur cet omit.
# Sans effet sur Synology (où devDeps s'installaient déjà) ; le runtime final
# reste léger (sortie standalone Next + node_modules copiés sélectivement).
RUN if [ -f package-lock.json ]; then npm ci --include=dev; else npm install --include=dev; fi
# `npm ci` peut omettre les optionalDependencies spécifiques à la plateforme
# (binaires natifs @img/sharp-linuxmusl-* et @napi-rs/canvas-linux-*-musl) quand
# le lockfile vient d'un autre OS (bug npm connu) → réinstallation ciblée pour la
# plateforme courante (Alpine/musl). sharp = vignettes ; canvas = rendu page PDF.
RUN npm install --include=optional --no-save sharp @napi-rs/canvas

# 2. Build (Next standalone) + données OCR
FROM node:22.13-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache wget ca-certificates
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Données de langue OCR (fra + eng) téléchargées au build → OCR 100 % hors-ligne au runtime.
RUN mkdir -p tessdata \
 && wget -qO tessdata/eng.traineddata.gz https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz \
 && wget -qO tessdata/fra.traineddata.gz https://tessdata.projectnaptha.com/4.0.0/fra.traineddata.gz
RUN npm run build

# 3. Runtime
FROM node:22.13-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/.data \
    TESSERACT_LANG_PATH=/app/tessdata \
    TESSERACT_CORE_PATH=/app/node_modules/tesseract.js-core \
    AI_FAST_MODE=true \
    NODE_OPTIONS=--experimental-sqlite

# su-exec : bascule root→nextjs après chown du volume. fontconfig/dejavu : rendu PDF.
# libc6-compat : filet de sécurité pour le chargement des binaires natifs (sharp).
RUN apk add --no-cache su-exec fontconfig ttf-dejavu libc6-compat
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Application (sortie standalone Next)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Paquets natifs / chargés PAR CHEMIN (non tracés par le build standalone) → copiés explicitement.
COPY --from=builder --chown=nextjs:nodejs /app/tessdata ./tessdata
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tesseract.js-core ./node_modules/tesseract.js-core
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@napi-rs ./node_modules/@napi-rs
# Vignettes : sharp (binaire natif via @img/sharp-linuxmusl-*) + rendu 1ʳᵉ page PDF (pdfjs-dist).
# Sans ces copies, makeThumbnail plante (même le placeholder passe par sharp) → aucune vignette.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdfjs-dist ./node_modules/pdfjs-dist

# Auto-tests : échouent le build si un binaire natif ne se charge pas dans
# l'image finale (musl). Évite de livrer une image aux vignettes cassées.
#  - sharp  : génération des vignettes (et du placeholder)
#  - canvas : rendu raster de la 1ʳᵉ page PDF
RUN node -e "require('sharp')({create:{width:4,height:4,channels:3,background:'#ffffff'}}).webp().toBuffer().then(b=>console.log('[build] sharp OK',b.length,'octets')).catch(e=>{console.error('[build] sharp KO:',e.message);process.exit(1)})"
RUN node -e "try{const{createCanvas}=require('@napi-rs/canvas');const c=createCanvas(8,8);c.getContext('2d').fillRect(0,0,8,8);console.log('[build] canvas OK',c.toBuffer('image/png').length,'octets')}catch(e){console.error('[build] canvas KO:',e.message);process.exit(1)}"
# pg : driver PostgreSQL (mode GEDIFY_STORAGE_MODE=postgres). Avertissement seul :
# en mode json pg est inutile ; en mode postgres, readStore retombe sur le JSON
# si pg ne se charge pas (ENABLE_JSON_FALLBACK).
RUN node -e "import('pg').then(()=>console.log('[build] pg OK (mode postgres disponible)')).catch(e=>console.warn('[build] pg indisponible (mode json OK, postgres en repli JSON):',e.message))" || true
# node:sqlite (intégré, mode GEDIFY_STORAGE_MODE=sqlite). Échoue le build si le
# module n'est pas disponible dans l'image (sinon le mode sqlite serait mort).
RUN node -e "const {DatabaseSync}=require('node:sqlite'); const d=new DatabaseSync(':memory:'); d.exec('PRAGMA journal_mode=WAL'); d.exec('CREATE TABLE t(x)'); d.prepare('INSERT INTO t VALUES(1)').run(); console.log('[build] node:sqlite OK', d.prepare('SELECT COUNT(*) AS n FROM t').get().n)"

# Répertoire de données persistant (point de montage du volume Coolify).
RUN mkdir -p /app/.data && chown -R nextjs:nodejs /app/.data

# ── Outils de migration JSON → PostgreSQL (exécutables DANS le conteneur) ──────
# Scripts compilés (committés) scripts/gedify-*.mjs : ESM autonome, sans tsx.
# On remplace le package.json (vide) de la sortie standalone Next par le VRAI
# (avec les scripts gedify:*), et on embarque le schéma SQL + le client Prisma 7
# runtime (compilateur WASM, pas de moteur natif), élagué des gros paquets CLI.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
# Scripts de déploiement Synology (génération des secrets + démarrage). Présents
# dans toutes les images mais invoqués UNIQUEMENT par docker-compose.sqlite.yml
# (Synology) — aucun effet sur les autres environnements (Coolify/Postgres).
COPY --from=builder --chown=nextjs:nodejs /app/deploy/synology ./deploy/synology
RUN chmod +x ./deploy/synology/scripts/*.sh \
 && sh -n ./deploy/synology/scripts/init-secrets.sh \
 && sh -n ./deploy/synology/scripts/start-synology.sh \
 && echo "[build] scripts Synology OK"
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
# Client Prisma 7 = driver adapter (pg, WASM) au runtime → aucun moteur natif
# requis pour l'APP : on élague les gros paquets inutiles à l'exécution applicative.
RUN rm -rf node_modules/@prisma/engines node_modules/@prisma/dev \
           node_modules/@prisma/studio-core node_modules/@prisma/fetch-engine \
           node_modules/@prisma/get-platform
# Prisma CLI au RUNTIME (`npm run db:push` / `db:migrate` / `db:generate` dans le
# conteneur SaaS) : installé GLOBALEMENT → closure de dépendances complète +
# schema-engine musl téléchargé pour la plateforme. Copier seulement le paquet
# `prisma` échouait (ses deps transitives — @prisma/dev → pglite/hono… — absentes
# de la sortie standalone). prisma.config.ts fournit l'URL (DATABASE_URL) car le
# datasource du schéma n'a pas d'`url`. Impacte uniquement l'image SaaS (Coolify).
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
RUN npm install -g prisma@7.8.0 \
 && prisma -v >/dev/null 2>&1 \
 && echo "[build] Prisma CLI runtime OK"
# Auto-tests : (1) les scripts gedify:* sont bien listés dans /app/package.json ;
# (2) la chaîne de migration se charge dans l'image (dry-run, n'écrit rien en base).
RUN node -e "const s=require('./package.json').scripts||{}; if(!s['gedify:migrate-json']){console.error('[build] scripts gedify absents du package.json');process.exit(1)} console.log('[build] scripts gedify présents')"
RUN node scripts/gedify-migrate-json.mjs --dry-run >/dev/null 2>&1 \
 && echo "[build] migration toolchain OK (dry-run)" \
 || (echo "[build] migration toolchain KO" && exit 1)
# Chaîne SQLite : crée une base jetable, vérifie tables + PRAGMA, puis la supprime.
RUN DATA_DIR=/tmp/sqlite-selftest node scripts/gedify-sqlite-init.mjs >/dev/null 2>&1 \
 && DATA_DIR=/tmp/sqlite-selftest node scripts/gedify-sqlite-inspect.mjs >/dev/null 2>&1 \
 && rm -rf /tmp/sqlite-selftest \
 && echo "[build] sqlite toolchain OK (init+inspect)" \
 || (echo "[build] sqlite toolchain KO" && exit 1)

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Démarre en root (chown du volume) puis bascule sur nextjs via l'entrypoint.
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
