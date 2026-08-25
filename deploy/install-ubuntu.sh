#!/usr/bin/env bash
# CyberDNS TIP — native (no Docker) install script for Ubuntu 22.04/24.04.
#
# Installs Node.js 20, PostgreSQL, creates the app database/user, builds the
# app, applies the schema, and registers a systemd service so it survives
# reboots. Safe to re-run: every step below is idempotent.
#
# Usage (run from the repo root, as a user with sudo):
#   chmod +x deploy/install-ubuntu.sh
#   ./deploy/install-ubuntu.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_USER="${APP_USER:-$(whoami)}"
DB_NAME="cyberdns_tip"
DB_APP_USER="cyberdns_app"

echo "==> Installing this app from: $REPO_DIR"

# ---- 1. Node.js 20 (NodeSource) ----
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed -E 's/^v([0-9]+).*/\1/')" -lt 20 ]; then
  echo "==> Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "==> Node.js already installed: $(node -v)"
fi

# ---- 2. PostgreSQL ----
if ! command -v psql >/dev/null 2>&1; then
  echo "==> Installing PostgreSQL..."
  sudo apt-get update
  sudo apt-get install -y postgresql postgresql-contrib
  sudo systemctl enable --now postgresql
else
  echo "==> PostgreSQL already installed."
fi

# ---- 3. Database + app role (idempotent) ----
if [ -z "${DB_APP_PASSWORD:-}" ]; then
  DB_APP_PASSWORD="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"
  echo "==> Generated PostgreSQL app password (save this — also written to .env): $DB_APP_PASSWORD"
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_APP_USER}') THEN
    CREATE ROLE ${DB_APP_USER} LOGIN PASSWORD '${DB_APP_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_APP_USER} PASSWORD '${DB_APP_PASSWORD}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_APP_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_APP_USER};
SQL

# ---- 4. .env (only written once — re-running never overwrites your edits) ----
if [ ! -f "$REPO_DIR/.env" ]; then
  echo "==> Writing $REPO_DIR/.env"
  SUPERADMIN_PW="$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 18)"
  cat > "$REPO_DIR/.env" <<ENV
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://${DB_APP_USER}:${DB_APP_PASSWORD}@localhost:5432/${DB_NAME}
DB_SSL=false
SUPERADMIN_EMAIL=admin@cyberdns.local
SUPERADMIN_PASSWORD=${SUPERADMIN_PW}
ENV
  echo "==> Super Admin will be admin@cyberdns.local / ${SUPERADMIN_PW} (change after first login)."
else
  echo "==> $REPO_DIR/.env already exists — leaving it untouched."
fi

# ---- 5. Install deps, build, apply schema ----
cd "$REPO_DIR"
echo "==> npm ci"
npm ci
echo "==> npm run build"
npm run build
echo "==> Applying database schema"
set -a; source "$REPO_DIR/.env"; set +a
echo "Yes" | npx drizzle-kit push --config=src/db/drizzle.config.ts

# ---- 6. systemd service ----
SERVICE_PATH="/etc/systemd/system/cyberdns-tip.service"
echo "==> Installing systemd unit at $SERVICE_PATH"
sudo tee "$SERVICE_PATH" >/dev/null <<UNIT
[Unit]
Description=CyberDNS TIP
After=network.target postgresql.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${REPO_DIR}
EnvironmentFile=${REPO_DIR}/.env
ExecStart=/usr/bin/node ${REPO_DIR}/dist/server.cjs
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now cyberdns-tip
echo "==> Done. Service status:"
sudo systemctl --no-pager status cyberdns-tip || true
echo ""
echo "CyberDNS TIP should now be reachable at http://<vps-ip>:3000"
echo "See deploy/nginx.conf.example to put it behind Nginx + HTTPS (recommended for anything beyond local testing)."
