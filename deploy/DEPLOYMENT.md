# Triển khai Production — CyberDNS TIP

Hướng dẫn triển khai **một môi trường production mới** trên VPS Ubuntu bằng
Docker Compose. Áp dụng cho cấu hình:

| Thành phần | Tên miền | Cổng nội bộ (loopback) |
|---|---|---|
| Dashboard + API + Blocklist URL | `tip.cyberdns.vn` | `127.0.0.1:3000` |
| Uptime Kuma (giám sát) | `uptime.cyberdns.vn` | `127.0.0.1:18080` |

> Blocklist URL (`https://tip.cyberdns.vn/v1/blocklist/<category>.txt`) chạy
> **cùng app, cùng cổng** với Dashboard — không cần vhost hay cổng riêng.

Toàn bộ lệnh chạy bằng user thường có quyền `sudo` (không đăng nhập trực tiếp `root`).

---

## 0. Kiến trúc

```
                Internet
                   │  443 / 80
          ┌────────▼─────────┐
          │  Nginx (VPS)     │  Let's Encrypt, HTTP→HTTPS redirect
          │  + ufw 22/80/443 │  X-Forwarded-For = $remote_addr (1 hop)
          └───┬──────────┬───┘
   tip.        │          │  uptime.
   cyberdns.vn │          │  cyberdns.vn
        ┌──────▼───┐  ┌───▼──────────┐
        │ app      │  │ uptime-kuma  │   (container riêng, ngoài compose)
        │ :3000    │  │ :3001→:18080 │
        │ (node,   │  └──────────────┘
        │  non-root)│
        └────┬─────┘
   mạng nội bộ compose │
        ┌────▼─────┐
        │ db       │  postgres:17-alpine, volume cyberdns_pgdata
        │ :5432    │  KHÔNG publish ra host
        └──────────┘
```

- App bind `127.0.0.1` (qua compose) → chỉ Nginx tới được, không lộ ra Internet.
- App tự set security header (HSTS/CSP/X-Frame-Options/…) — Nginx chỉ proxy qua.
- Migration DB chạy tự động mỗi lần container `app` khởi động (`dist/migrate.cjs`).
- **DB mới hoàn toàn**: KHÔNG chạy `db:baseline` (xem [`MIGRATION.md`](../MIGRATION.md)).

---

## 1. Chuẩn bị VPS

Yêu cầu tối thiểu: Ubuntu 22.04 / 24.04, 2 GB RAM, 2 vCPU, 20 GB SSD (feed lớn
như Hagezi/OISD nạp hàng trăm nghìn domain — 4 GB RAM thoải mái hơn).

```bash
# Cập nhật hệ thống
sudo apt-get update && sudo apt-get upgrade -y

# (khuyến nghị) timezone UTC + swap 2G nếu RAM ≤ 2GB
sudo timedatectl set-timezone UTC
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Docker Engine + Compose plugin (repo chính thức)
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Cho user hiện tại chạy docker không cần sudo (đăng xuất/đăng nhập lại sau lệnh này)
sudo usermod -aG docker "$USER"
newgrp docker   # hoặc logout rồi login lại

docker --version && docker compose version
```

---

## 2. DNS

Tạo **2 bản ghi A** trỏ về IP public của VPS, TTL thấp (300s) trong lúc setup:

| Host | Type | Value |
|---|---|---|
| `tip.cyberdns.vn` | A | `<IP_PUBLIC_VPS>` |
| `uptime.cyberdns.vn` | A | `<IP_PUBLIC_VPS>` |

Chờ DNS phân giải xong **trước khi** làm bước 6 (Certbot xác minh quyền sở hữu qua HTTP):

```bash
dig +short tip.cyberdns.vn
dig +short uptime.cyberdns.vn
# cả hai phải trả về đúng IP VPS
```

---

## 3. Lấy source + cấu hình `.env`

```bash
git clone https://github.com/trinv/cyberdns-tip-admin.git cyberdns-tip
cd cyberdns-tip
cp .env.example .env
```

Sinh sẵn 2 mật khẩu mạnh:

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)"
echo "SUPERADMIN_PASSWORD=$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 20)"
```

Mở `.env` và đặt các giá trị sau (các dòng khác giữ mặc định):

```ini
NODE_ENV=production

# --- Bắt buộc ---
POSTGRES_PASSWORD=<chuỗi 32 ký tự vừa sinh ở trên>
SUPERADMIN_EMAIL=admin@cyberdns.vn
SUPERADMIN_PASSWORD=<chuỗi 20 ký tự vừa sinh ở trên>

# --- Nút "DNS Map Monitoring" trong app trỏ sang Uptime Kuma ---
# (được nhúng vào bundle lúc BUILD — phải đặt TRƯỚC `up -d --build`)
VITE_UPTIME_KUMA_URL=https://uptime.cyberdns.vn

# --- Tuỳ chọn: cảnh báo email khi đăng nhập từ IP lạ ---
# Bỏ trống SMTP_HOST để tắt (cảnh báo trong app vẫn hoạt động).
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_SECURE=false
SMTP_FROM=CyberDNS TIP <alerts@cyberdns.vn>
SECURITY_ALERT_EMAIL=security@cyberdns.vn

# --- Tinh chỉnh PostgreSQL theo RAM của VPS ---
# 2GB:  256MB / 768MB   |   4GB: 1GB / 3GB   |   8GB: 2GB / 6GB
PG_SHARED_BUFFERS=256MB
PG_EFFECTIVE_CACHE_SIZE=768MB
PG_MAX_WAL_SIZE=1GB
PG_CHECKPOINT_TIMEOUT=15min
```

> `DATABASE_URL`, `DB_SSL`, `HOST`, `PORT` trong `.env` bị `docker-compose.yml`
> ghi đè cho đường Docker — không cần chỉnh.
>
> Nếu để `SUPERADMIN_PASSWORD` nguyên chuỗi mẫu `CHANGE_ME_STRONG_PASSWORD`,
> app coi như chưa đặt và **tự sinh mật khẩu ngẫu nhiên, in ra log 1 lần**.

`.env` đã nằm trong `.gitignore` và `.dockerignore` — không bị commit, không vào image.

---

## 4. Triển khai CyberDNS TIP

```bash
docker compose up -d --build
```

Lần đầu sẽ: build image (client Vite + server esbuild) → khởi động `db` → chờ
healthcheck → container `app` chạy `dist/migrate.cjs` (tạo toàn bộ schema từ
`drizzle/0000` + `0001`) → khởi động server.

Theo dõi:

```bash
docker compose logs -f app
```

Chờ tới khi thấy:

```
[migrate] applied 2 new migration(s).
============================================================
 Đã tạo tài khoản Super Admin cho CyberDNS TIP:
   Email:    admin@cyberdns.vn
   Mật khẩu: <mật khẩu bạn đặt, hoặc chuỗi ngẫu nhiên nếu để trống>
============================================================
CyberDNS TIP Full-stack server running on http://0.0.0.0:3000
```

Kiểm tra nhanh (chưa có domain/HTTPS):

```bash
curl -s http://127.0.0.1:3000/api/health
# {"status":"ok","engine":"CyberDNS TIP Backend","timestamp":"..."}
```

Trạng thái container:

```bash
docker compose ps    # cả db (healthy) và app (running) đều Up
```

---

## 5. Triển khai Uptime Kuma

Chạy như một container độc lập (không thuộc `docker-compose.yml` của app), bind loopback:

```bash
docker run -d \
  --name uptime-kuma \
  --restart unless-stopped \
  -p 127.0.0.1:18080:3001 \
  -v uptime-kuma:/app/data \
  louislam/uptime-kuma:1

curl -sI http://127.0.0.1:18080 | head -1    # HTTP/1.1 302 Found — OK
```

Bước cấu hình tài khoản admin của Uptime Kuma làm sau (bước 7), qua trình duyệt.

---

## 6. Nginx + HTTPS cho cả 2 tên miền

Script `deploy/setup-domain-ssl.sh` làm trọn gói cho **mỗi** domain: cài Nginx
+ Certbot (nếu chưa có), viết vhost (`X-Forwarded-For $remote_addr`, WebSocket
upgrade), bật `ufw` (chỉ mở 22/80/443), xin chứng chỉ Let's Encrypt + bật
auto-renew + redirect HTTP→HTTPS.

```bash
cd ~/cyberdns-tip
chmod +x deploy/setup-domain-ssl.sh

# Dashboard + Blocklist URL
./deploy/setup-domain-ssl.sh tip.cyberdns.vn 3000 cyberdns-tip

# Uptime Kuma
./deploy/setup-domain-ssl.sh uptime.cyberdns.vn 18080 uptime-kuma
```

> Certbot dùng email `admin@cyberdns.vn` (suy từ tên miền) chỉ để gửi nhắc hạn
> chứng chỉ. Muốn email khác: chạy `sudo certbot --nginx -d tip.cyberdns.vn
> --redirect -m you@example.com --agree-tos` thay cho lần script gọi certbot.

Sau bước này:

```bash
curl -sI https://tip.cyberdns.vn/api/health | grep -Ei 'HTTP/|strict-transport|content-security|x-frame'
```

Phải thấy `HTTP/2 200`, `strict-transport-security`, `content-security-policy`,
`x-frame-options: DENY` — nghĩa là app nhận đúng `X-Forwarded-Proto: https`
và security header đi xuyên qua Nginx.

---

## 7. Kiểm tra sau triển khai

| Kiểm tra | Cách |
|---|---|
| Dashboard | Mở `https://tip.cyberdns.vn` → hiện trang đăng nhập |
| Đăng nhập | `admin@cyberdns.vn` / mật khẩu ở bước 4 |
| Redirect | `curl -sI http://tip.cyberdns.vn` → `301` sang `https://` |
| HSTS/CSP | Lệnh `curl` ở cuối bước 6 |
| Uptime Kuma | Mở `https://uptime.cyberdns.vn` → tạo tài khoản admin lần đầu |
| Nút liên kết | Trong app → **Quản lý DNS Node** → nút "DNS Map Monitoring" phải **bật** (nếu mờ: `VITE_UPTIME_KUMA_URL` chưa được build vào — xem Troubleshooting) |
| Blocklist URL | Sau khi tạo category ở bước 8: `curl https://tip.cyberdns.vn/v1/blocklist/<category-id>.txt` |
| ufw | `sudo ufw status` → chỉ 22, 80, 443 (v4+v6) |
| Port nội bộ | `sudo ss -tlnp | grep -E ':(3000|18080|5432)'` → tất cả bind `127.0.0.1`, không `0.0.0.0` |

---

## 8. Cấu hình nghiệp vụ ban đầu (trong app)

Thứ tự khuyến nghị, tất cả làm qua giao diện `https://tip.cyberdns.vn`:

1. **Đổi mật khẩu Super Admin** — menu tài khoản → Người dùng & Phân quyền →
   sửa chính mình. (Đổi mật khẩu tự động thu hồi mọi phiên cũ.)
2. **Tạo tài khoản cho team** — Người dùng & Phân quyền → Thêm. Vai trò:
   - `Analyst` — đề xuất + sửa domain lẻ
   - `Reviewer` — thêm quyền duyệt Review Queue + bulk action
   - `Admin` — thêm toàn bộ cấu hình (category, feed, user, DNS node, ACL)
3. **Tạo Nhóm danh mục (Category)** — sidebar Domain Explorer → "Thêm nhóm mới".
   `id` của category chính là phần `<category>` trong URL blocklist. Ví dụ tạo
   `malware-phishing`, `gambling`, `nsfw` → URL:
   `https://tip.cyberdns.vn/v1/blocklist/malware-phishing.txt`
4. **Khai báo DNS Node** — Quản lý DNS Node → thêm từng resolver Blocky thật
   (tên, IPv4/IPv6 công khai, tier, vị trí). Đây đồng thời là **danh sách IP
   được phép** gọi Blocklist URL.
5. **Bật ACL Blocklist** (tuỳ chọn, làm sau khi đã khai báo đủ node) — Quản lý
   DNS Node → công tắc ACL. Mặc định **TẮT** = chỉ ghi log IP lạ; bật = chỉ IP
   của node đã khai báo mới tải được `.txt`.
6. **Thêm nguồn Threat Feed** — Nguồn Threat Feeds → Thêm (chỉ Admin). URL feed
   phải là `http(s)` công khai (chặn IP nội bộ/metadata — SSRF guard). Gán vào
   một category, rồi bấm "Đồng bộ". Có thể để feed đẩy domain vào **Review
   Queue** thay vì chặn thẳng.
7. **Cấu hình Blocky** (trên từng DNS resolver) trỏ về URL blocklist:

   ```yaml
   blocking:
     denylists:
       malware-phishing:
         - https://tip.cyberdns.vn/v1/blocklist/malware-phishing.txt
       gambling:
         - https://tip.cyberdns.vn/v1/blocklist/gambling.txt
     clientGroupsBlock:
       default:
         - malware-phishing
         - gambling
     refreshPeriod: 4h
   ```

8. **Uptime Kuma** — thêm monitor:
   - HTTP(s) `https://tip.cyberdns.vn/api/health` (kỳ vọng chuỗi `"status":"ok"`)
   - HTTP(s) `https://tip.cyberdns.vn/v1/blocklist/malware-phishing.txt`
   - TCP từng DNS node cổng 53 (nếu muốn)

---

## 9. Backup tự động

Dữ liệu nằm trong Docker volume `cyberdns_pgdata`. Đặt cron `pg_dump` hằng ngày:

```bash
sudo mkdir -p /opt/cyberdns-backups
sudo tee /etc/cron.daily/cyberdns-backup >/dev/null <<'SH'
#!/bin/sh
cd /home/<USER>/cyberdns-tip || exit 1
OUT=/opt/cyberdns-backups/cyberdns_tip-$(date +\%F).sql.gz
docker compose exec -T db pg_dump -U cyberdns_app cyberdns_tip | gzip > "$OUT"
find /opt/cyberdns-backups -name '*.sql.gz' -mtime +14 -delete
SH
sudo sed -i "s|<USER>|$USER|" /etc/cron.daily/cyberdns-backup
sudo chmod +x /etc/cron.daily/cyberdns-backup

# chạy thử
sudo /etc/cron.daily/cyberdns-backup && ls -lh /opt/cyberdns-backups
```

Backup Uptime Kuma (nhẹ): `docker run --rm -v uptime-kuma:/data -v /opt/cyberdns-backups:/b alpine tar czf /b/uptime-kuma-$(date +%F).tgz -C /data .`

**Khôi phục** (thảm hoạ):

```bash
docker compose up -d db
gunzip -c /opt/cyberdns-backups/cyberdns_tip-YYYY-MM-DD.sql.gz \
  | docker compose exec -T db psql -U cyberdns_app -d cyberdns_tip
docker compose up -d app
```

---

## 10. Vận hành

| Việc | Lệnh (trong `~/cyberdns-tip`) |
|---|---|
| Cập nhật app | `git pull && docker compose up -d --build` |
| Xem log | `docker compose logs -f app` |
| Khởi động lại | `docker compose restart app` |
| Trạng thái | `docker compose ps` |
| Dừng toàn bộ | `docker compose down` (dữ liệu vẫn còn trong volume) |
| Vào DB | `docker compose exec db psql -U cyberdns_app cyberdns_tip` |
| Đổi schema | Xem [`MIGRATION.md`](../MIGRATION.md) — `db:generate` → review → commit → `up -d --build` |
| Update Uptime Kuma | `docker pull louislam/uptime-kuma:1 && docker rm -f uptime-kuma && <lệnh docker run ở bước 5>` |
| Gia hạn SSL | Tự động (`systemctl status certbot.timer`); ép: `sudo certbot renew` |

Cập nhật app **không cần** `db:baseline`; migration mới (nếu có) tự chạy khi
container `app` khởi động lại. Nếu migration lỗi, container thoát với mã khác 0
và **không** khởi động server với schema dở dang — xem log, sửa, deploy lại.

---

## 11. Checklist bảo mật

- [ ] Đã đổi mật khẩu Super Admin sau lần đăng nhập đầu
- [ ] `POSTGRES_PASSWORD` + `SUPERADMIN_PASSWORD` là chuỗi ngẫu nhiên (không phải mẫu)
- [ ] `sudo ufw status` chỉ mở 22/80/443
- [ ] `ss -tlnp` xác nhận 3000/18080/5432 bind `127.0.0.1`
- [ ] `curl -sI https://tip.cyberdns.vn` có HSTS + CSP + `x-frame-options`
- [ ] SSH: tắt đăng nhập mật khẩu root, dùng key (`/etc/ssh/sshd_config`)
- [ ] Backup cron đã chạy thử thành công, có file trong `/opt/cyberdns-backups`
- [ ] Bật ACL Blocklist sau khi khai báo đủ DNS node (nếu muốn blocklist không công khai)
- [ ] `docker compose logs app` không in mật khẩu bootstrap ở lần khởi động thứ 2 trở đi

---

## 12. Troubleshooting

**Certbot lỗi "challenge failed" / "NXDOMAIN"**
DNS A record chưa trỏ đúng IP VPS, hoặc chưa phân giải. Kiểm tra `dig +short
tip.cyberdns.vn`, đợi rồi chạy lại: `sudo certbot --nginx -d tip.cyberdns.vn --redirect`.

**Nút "DNS Map Monitoring" bị mờ**
`VITE_UPTIME_KUMA_URL` chưa được nhúng vào bundle. Kiểm tra `.env` có dòng đó,
rồi **build lại**: `docker compose up -d --build app`. (Biến `VITE_*` chỉ đọc
lúc build, không phải runtime.)

**Bản đồ (tab DNS Node) không hiện tile / font lỗi**
Mở DevTools → Console tìm lỗi `Content-Security-Policy`. CSP nằm ở
`src/middleware/securityHeaders.ts` — nếu CARTO đổi host tile, thêm host vào
`connect-src` / `img-src` rồi `up -d --build`.

**`app` restart liên tục, log `[migrate] FAILED`**
Migration lỗi. `docker compose logs app` xem câu SQL. DB mới thì **không** chạy
`db:baseline`. Nếu là DB nâng cấp từ bản cũ (`drizzle-kit push`) → phải
`db:baseline` một lần trước (xem [`MIGRATION.md`](../MIGRATION.md)).

**`db` không `healthy`**
`docker compose logs db`. Thường do `POSTGRES_PASSWORD` chưa đặt trong `.env`,
hoặc volume cũ có mật khẩu khác (`docker compose down -v` sẽ **XOÁ dữ liệu** —
chỉ dùng khi cài mới hoàn toàn).

**Đăng nhập bị khoá "Quá nhiều lần thất bại"**
Rate limiter: 8 lần sai / 15 phút (theo IP và theo email) → khoá 15 phút.
Reset bằng cách `docker compose restart app` (bộ đếm nằm in-memory).

**Blocklist `.txt` trả `403`**
ACL đang bật và IP gọi không thuộc DNS node nào đã khai báo. Thêm node với IP
đó, hoặc tắt công tắc ACL.

**Feed sync đứng ở "syncing"**
Container `app` bị restart giữa chừng — `recoverInterruptedSyncs()` tự dọn khi
khởi động lại. Nếu vẫn kẹt: sửa nguồn → "Tạm dừng" rồi "Tiếp tục".

**Đọc chi tiết bảo mật / kiến trúc**: [`README.md`](../README.md),
[`MIGRATION.md`](../MIGRATION.md).
