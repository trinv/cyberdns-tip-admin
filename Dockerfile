# syntax=docker/dockerfile:1

# ---- Build stage: compile the client (Vite) and bundle the server (esbuild) ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime stage ----
# Keeps devDependencies (drizzle-kit in particular) installed on purpose:
# docker-entrypoint.sh runs `drizzle-kit push` against the real TypeScript
# schema (src/db/schema.ts) on every start so the database schema is always
# up to date with whatever image is running, without a separate manual
# migration step. This trades a larger image for a simpler, self-contained
# "docker compose up" install.
FROM node:20-alpine AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
# NODE_ENV is set AFTER `npm ci`, not before: npm treats NODE_ENV=production
# as an implicit --omit=dev, which would silently skip drizzle-kit (a
# devDependency docker-entrypoint.sh needs at runtime).
RUN npm ci
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/server.cjs"]
