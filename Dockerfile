# Tablée, la cantine sans file : l'image du serveur.
# Node 24, Next.js en production, base SQLite dans le volume /donnees (un fichier, rien d'autre à lancer).
# Aucun secret dans l'image : BETTER_AUTH_SECRET, BETTER_AUTH_URL et PISPI_ALIAS arrivent par l'environnement du serveur.

FROM node:24-alpine AS dependances
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS construction
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=dependances /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# La construction ne lit ni la base ni les secrets : des valeurs factices suffisent, et elles ne passent pas dans l'image finale.
ENV DATABASE_URL="file:/tmp/construction.db" BETTER_AUTH_SECRET="valeur-de-construction-sans-usage" BETTER_AUTH_URL="http://localhost:3700"
RUN npx prisma generate && npx next build

FROM node:24-alpine AS serveur
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3700 DATABASE_URL="file:/donnees/cantine.db"
COPY --from=construction /app ./
VOLUME ["/donnees"]
EXPOSE 3700
# Au démarrage : la base suit le schéma (sans rien effacer), puis le serveur écoute.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx next start -H 0.0.0.0 -p ${PORT}"]
