#!/usr/bin/env bash
# Puts Nginx in front of CyberDNS TIP (whether it's running via Docker
# Compose on 127.0.0.1:3000 or the native systemd service on 0.0.0.0:3000)
# with a real domain + free auto-renewing HTTPS via Let's Encrypt/Certbot,
# and locks the firewall down to only 22/80/443 — the app port itself
# should never be reachable directly from the internet (see docker-compose.
# yml's 127.0.0.1-only binding and server.ts's `trust proxy` comment for why
# that matters for login logging to be trustworthy, not just for security).
#
# Prerequisite: the domain's DNS A record must already point at this VPS's
# public IP before running this — Certbot verifies ownership over HTTP.
#
# Usage (run from the repo root, as a user with sudo):
#   chmod +x deploy/setup-domain-ssl.sh
#   ./deploy/setup-domain-ssl.sh tipadmin.cyberdns.vn
#   # or just: ./deploy/setup-domain-ssl.sh   (defaults to tipadmin.cyberdns.vn)
set -euo pipefail

DOMAIN="${1:-tipadmin.cyberdns.vn}"
APP_PORT="${APP_PORT:-3000}"
SITE_NAME="cyberdns-tip"

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

# ---- 2. Vhost (HTTP first — Certbot upgrades it to HTTPS in step 4) ----
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
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
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

# ---- 3. Firewall: only 22 (SSH), 80, 443 reachable from the internet ----
if command -v ufw >/dev/null 2>&1; then
  echo "==> Configuring ufw (22/80/443 only — app port ${APP_PORT} stays internal)"
  sudo ufw allow OpenSSH >/dev/null 2>&1 || sudo ufw allow 22/tcp
  sudo ufw allow 'Nginx Full' >/dev/null 2>&1 || { sudo ufw allow 80/tcp; sudo ufw allow 443/tcp; }
  sudo ufw --force enable
else
  echo "==> ufw not found — skipping firewall step. Make sure port ${APP_PORT} is NOT reachable from outside this VPS by whatever firewall you do use."
fi

# ---- 4. HTTPS via Let's Encrypt (upgrades the vhost above in place, sets up auto-renew) ----
echo "==> Requesting a Let's Encrypt certificate for ${DOMAIN}..."
sudo certbot --nginx -d "${DOMAIN}" --redirect --non-interactive --agree-tos -m "admin@${DOMAIN#*.}" || {
  echo "==> Certbot failed — this almost always means ${DOMAIN}'s DNS A record isn't pointing at this VPS's public IP yet."
  echo "    Fix the DNS record, then re-run: sudo certbot --nginx -d ${DOMAIN} --redirect"
  exit 1
}

echo ""
echo "==> Done. CyberDNS TIP should now be reachable at: https://${DOMAIN}"
echo "    Certbot's systemd timer renews the certificate automatically — verify with: sudo systemctl status certbot.timer"
