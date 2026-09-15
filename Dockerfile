# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
WORKDIR /app
# Prisma's native engine requires OpenSSL; glibc also matches bcrypt/Sharp binaries.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm run db:generate \
    && npm prune --omit=dev \
    && npm cache clean --force

FROM base AS production
ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PRISMA_HIDE_UPDATE_MESSAGE=true
LABEL org.opencontainers.image.title="COSOREMI Portal" \
      org.opencontainers.image.source="https://github.com/prinako/cosoremi-portal"
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json app.js server.js prisma.config.ts ./
COPY config ./config
COPY controllers ./controllers
COPY middleware ./middleware
COPY routes ./routes
COPY services ./services
COPY utils ./utils
COPY validators ./validators
COPY views ./views
COPY public ./public
COPY prisma ./prisma
COPY docker ./docker
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/cosoremi-entrypoint
RUN mkdir -p public/uploads/blog public/uploads/gallery public/uploads/pages \
    && chown -R node:node public/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["node", "docker/healthcheck.cjs"]
ENTRYPOINT ["cosoremi-entrypoint"]
CMD ["node", "server.js"]
