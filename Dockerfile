# syntax=docker/dockerfile:1

# ---- Build stage: compile the client (Vite) and bundle the server + the
# migration runner (esbuild) ----
FROM node:20-alpine AS builder
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
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server.cjs"]
