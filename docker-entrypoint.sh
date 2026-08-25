#!/bin/sh
# Applies the current schema (src/db/schema.ts) to the database before the
# server starts, every time the container starts. This is idempotent — if
# the schema already matches, drizzle-kit reports "No changes detected" and
# does nothing. The "Yes" answers drizzle-kit's interactive confirmation
# prompt non-interactively (there is no TTY inside a container).
#
# NOTE for a production/"final version" deploy: a schema change that would
# be genuinely destructive (e.g. dropping a column with real data in it)
# will also get auto-confirmed here. For anything beyond casual dev/test
# iteration, review `docker compose run --rm app npm run db:push` output
# BEFORE rolling out an image with schema changes, instead of relying on
# this automatic apply-on-boot.
set -e

echo "[entrypoint] Applying database schema (drizzle-kit push)..."
echo "Yes" | npx drizzle-kit push --config=src/db/drizzle.config.ts

echo "[entrypoint] Starting CyberDNS TIP..."
exec "$@"
