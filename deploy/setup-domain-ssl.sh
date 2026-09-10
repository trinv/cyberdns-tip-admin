#!/usr/bin/env bash
# Reverse-proxies ONE local service on this VPS behind Nginx with a real
# domain + free auto-renewing HTTPS (Let's Encrypt/Certbot) — used for both
# CyberDNS TIP itself AND any other local service that needs its own
# subdomain (e.g. an Uptime Kuma container). Includes WebSocket upgrade
# support unconditionally: required for Uptime Kuma's real-time dashboard,
# and a harmless no-op for plain HTTP/REST services like the TIP app —
# nginx only actually upgrades the connection when the client's own request
# asks for it (see the shared $connection_upgrade map installed below).
#
# Run once per domain (locks 22/80/443 open + strips other public access
# EVERY run, so re-running for a second domain doesn't reopen anything).
#
# Usage (from the repo root, as a user with sudo):
#   chmod +x deploy/setup-domain-ssl.sh
#   ./deploy/setup-domain-ssl.sh <domain> [port] [site-name]
#
# This deployment's real domains:
#   ./deploy/setup-domain-ssl.sh tip.cyberdns.vn 3000 cyberdns-tip
#   ./deploy/setup-domain-ssl.sh uptime.cyberdns.vn 18080 uptime-kuma
#
# Prerequisite: the domain's DNS A record must already point at this VPS's
# public IP before running this — Certbot verifies ownership over HTTP.
set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain> [port] [site-name]  — e.g. $0 tip.cyberdns.vn 3000 cyberdns-tip}"
APP_PORT="${2:-3000}"
SITE_NAME="${3:-${DOMAIN%%.*}}"

echo "==> Configuring Nginx + HTTPS for: $DOMAIN (proxying to 127.0.0.1:${APP_PORT})"

# ---- 1. Nginx + Certbot ----
if ! command -v nginx >/dev/null 2>&1; then
  echo "==> Installing Nginx..."
  sudo apt-get update
  sudo apt-get install -y nginx
fi
if ! command -v certbot >/dev/null 2>&1; then
  echo "==> Installing Certbot..."
  sudo apt-get install -y certbot python3-certbot-nginx
fi

# ---- 2. Shared WebSocket-upgrade map (installed once, reused by every
# vhost this script writes) — the standard nginx idiom: $connection_upgrade
# becomes "upgrade" only when the client's own request actually sent an
# Upgrade header (e.g. Uptime Kuma's Socket.IO handshake), and "close"
# otherwise, so plain HTTP requests to the TIP app are completely
# unaffected. Must live in the `http` block, not inside a `server {}` —
# conf.d/*.conf is included there by the stock Debian/Ubuntu nginx package.
WS_MAP_PATH="/etc/nginx/conf.d/websocket-upgrade.conf"
if [ ! -f "$WS_MAP_PATH" ]; then
  echo "==> Installing shared WebSocket-upgrade map at $WS_MAP_PATH"
  sudo tee "$WS_MAP_PATH" >/dev/null <<'NGINX'
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
NGINX
fi

# ---- 3. Vhost (HTTP first — Certbot upgrades it to HTTPS in step 5) ----
CONF_PATH="/etc/nginx/sites-available/${SITE_NAME}"
echo "==> Writing $CONF_PATH"
sudo tee "$CONF_PATH" >/dev/null <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        # REPLACE, not append: the TIP app trusts exactly one proxy hop
        # (server.ts: trust proxy = 1) and derives req.ip — used by
        # login-anomaly detection and the blocklist ACL — from this header.
        # Appending would let a client prepend a spoofed address.
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # WebSocket upgrade support (see the shared map above) — needed by
        # Uptime Kuma's Socket.IO dashboard; a no-op for plain HTTP.
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        # Default (60s) can be shorter than a slow query legitimately takes
        # under heavy write load (e.g. mid-checkpoint on a VPS with slow
        # disk I/O — see .env.example's PG_MAX_WAL_SIZE), or than a
        # long-lived WebSocket connection should be allowed to idle.
        proxy_read_timeout 120s;
    }
}
NGINX

sudo ln -sf "$CONF_PATH" "/etc/nginx/sites-enabled/${SITE_NAME}"
# Disable the default vhost only if it's still the untouched stock one —
# never blindly remove a site an operator may have customized.
if [ -f /etc/nginx/sites-enabled/default ] && cmp -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default 2>/dev/null; then
  sudo rm -f /etc/nginx/sites-enabled/default
fi

sudo nginx -t
sudo systemctl reload nginx

# ---- 4. Firewall: only 22 (SSH), 80, 443 reachable from the internet ----
if command -v ufw >/dev/null 2>&1; then
  echo "==> Configuring ufw (22/80/443 only — app port ${APP_PORT} stays internal)"
  sudo ufw allow OpenSSH >/dev/null 2>&1 || sudo ufw allow 22/tcp
  sudo ufw allow 'Nginx Full' >/dev/null 2>&1 || { sudo ufw allow 80/tcp; sudo ufw allow 443/tcp; }
  sudo ufw --force enable
else
  echo "==> ufw not found — skipping firewall step. Make sure port ${APP_PORT} is NOT reachable from outside this VPS by whatever firewall you do use."
fi

# ---- 5. HTTPS via Let's Encrypt (upgrades the vhost above in place, sets up auto-renew) ----
echo "==> Requesting a Let's Encrypt certificate for ${DOMAIN}..."
sudo certbot --nginx -d "${DOMAIN}" --redirect --non-interactive --agree-tos -m "admin@${DOMAIN#*.}" || {
  echo "==> Certbot failed — this almost always means ${DOMAIN}'s DNS A record isn't pointing at this VPS's public IP yet."
  echo "    Fix the DNS record, then re-run: sudo certbot --nginx -d ${DOMAIN} --redirect"
  exit 1
}

echo ""
echo "==> Done. This service should now be reachable at: https://${DOMAIN}"
echo "    Certbot's systemd timer renews the certificate automatically — verify with: sudo systemctl status certbot.timer"
