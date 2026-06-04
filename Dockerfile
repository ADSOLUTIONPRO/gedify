# Gedify autonome (nopp) — SANS Paperless. Image Docker pour Coolify.
# Moteur documentaire local embarqué + OCR hors-ligne (Tesseract fra+eng).

# 1. Dépendances
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
# `npm ci` peut omettre les optionalDependencies spécifiques à la plateforme
# (binaire natif @img/sharp-linuxmusl-*) quand le lockfile vient d'un autre OS
# (bug npm connu) → réinstallation ciblée pour la plateforme courante (Alpine/musl).
RUN npm install --include=optional --no-save sharp

# 2. Build (Next standalone) + données OCR
FROM node:20-alpine AS builder
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
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/.data \
    TESSERACT_LANG_PATH=/app/tessdata \
    TESSERACT_CORE_PATH=/app/node_modules/tesseract.js-core \
    AI_FAST_MODE=true

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

# Auto-test : échoue le build si sharp ne se charge pas réellement dans l'image
# finale (musl). Évite de livrer une image aux vignettes silencieusement cassées.
RUN node -e "require('sharp')({create:{width:4,height:4,channels:3,background:'#ffffff'}}).webp().toBuffer().then(b=>console.log('[build] sharp OK',b.length,'octets')).catch(e=>{console.error('[build] sharp KO:',e.message);process.exit(1)})"

# Répertoire de données persistant (point de montage du volume Coolify).
RUN mkdir -p /app/.data && chown -R nextjs:nodejs /app/.data

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Démarre en root (chown du volume) puis bascule sur nextjs via l'entrypoint.
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
