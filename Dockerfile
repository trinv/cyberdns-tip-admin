# syntax=docker/dockerfile:1

# ---- Build stage: compile the client (Vite) and bundle the server + the
# migration runner (esbuild) ----
# node:22-alpine (current LTS — Node 20 goes EOL 2026-04). Pin a digest here
# (node:22-alpine@sha256:…) if you want fully reproducible builds; the plain
# tag is used so `docker compose build` picks up Alpine/Node security patches.
FROM node:22-alpine AS builder
# Build-time only: Vite bakes VITE_* into the client bundle (import.meta.env).
# docker-compose.yml passes this through build.args from the project .env.
ARG VITE_UPTIME_KUMA_URL=""
ENV VITE_UPTIME_KUMA_URL=$VITE_UPTIME_KUMA_URL
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime stage ----
# Slim: only production dependencies. drizzle-kit is NOT needed at runtime any
# more — schema changes ship as reviewed SQL in ./drizzle and are applied by
# dist/migrate.cjs (bundled, uses drizzle-orm's migrator, a prod dependency).
# See docker-entrypoint.sh and MIGRATION.md.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Drop root — the app only ever reads its bundle and talks to Postgres over
# the network; it writes nothing to the filesystem. The `node` user (uid
# 1000) ships in the official image.
USER node

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server.cjs"]
