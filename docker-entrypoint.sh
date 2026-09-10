#!/bin/sh
# Applies any pending versioned database migrations (the reviewed SQL files
# in ./drizzle, tracked in drizzle.__drizzle_migrations) before the server
# starts, then execs the server.
#
# This replaced the old `echo "Yes" | drizzle-kit push`: push diffed
# src/db/schema.ts against the live DB and auto-confirmed its prompt, so a
# change it classified as destructive (a column rename reads as drop + add)
# would silently drop real data on the next container start. Migrations only
# ever run SQL a human wrote and committed.
#
# FIRST cut-over on an EXISTING database: run `npm run db:baseline` once
# against that DB before deploying this image (see MIGRATION.md), so the
# already-present tables are recorded as applied instead of re-created.
set -e

echo "[entrypoint] Applying database migrations..."
node dist/migrate.cjs

echo "[entrypoint] Starting CyberDNS TIP..."
exec "$@"
