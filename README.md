# CyberDNS TIP

Threat Intelligence & Domain Blocklist management platform — sync domain blocklists from feed sources (or import manually), organize them into categories, review/approve before blocking, and browse/export the result. Built with React 19 + Vite, a single Express server, and PostgreSQL (Drizzle ORM).

## Tính năng chính

- **Đồng bộ nguồn feed thật**: kéo toàn bộ nội dung từ URL feed (hỗ trợ định dạng hosts-file và AdBlock/uBlock), phân tích, loại trùng, ghi vào PostgreSQL theo lô — không giới hạn số lượng domain/lần đồng bộ. Tiến trình % chạy nền ở server, không mất khi chuyển tab.
- **Tùy chọn "yêu cầu xác nhận thủ công"** cho từng nguồn feed: domain mới phát hiện có thể vào Hàng đợi duyệt (Review Queue) thay vì tự động chặn ngay.
- **Mỗi tên miền chỉ thuộc đúng 1 danh mục** — thực thi ở tầng database (unique constraint + trigger), không thể trùng lặp phân loại.
- **Domain Explorer**: lọc/sắp xếp/phân trang phía server, xuất toàn bộ danh mục (không giới hạn theo trang) ra .txt/.csv/.hosts/.rpz/AdBlock/dnsmasq.
- **Quản lý người dùng & phân quyền** tự host (email/mật khẩu, không phụ thuộc Google/Firebase), tài khoản Super Admin tự tạo khi khởi động lần đầu nếu chưa có Admin nào. Toàn bộ ứng dụng yêu cầu đăng nhập — chưa xác thực chỉ thấy trang đăng nhập, không vào thẳng được Dashboard.
- **Nhật ký đăng nhập & cảnh báo IP mới**: mọi lượt đăng nhập (thành công lẫn thất bại) đều ghi lại IP thật + trình duyệt (qua Nginx `X-Forwarded-For`); đăng nhập từ IP chưa từng dùng sẽ hiện cảnh báo ngay trong ứng dụng, và Admin xem được toàn bộ lịch sử ở mục "Nhật ký đăng nhập".
- **Quản lý DNS Node & ACL cho Blocklist URL** (Admin): danh mục hạ tầng DNS resolver thật của CyberDNS (IP/hostname, tier LITE/PRO/FAMILY, vị trí chọn theo Quốc gia/Tỉnh-Thành phố với bản đồ OpenStreetMap miễn phí hiển thị chính xác toạ độ, nhà cung cấp, trạng thái Active/Inactive) — đồng thời là danh sách IP được phép gọi Blocklist URL. Công tắc chặn ACL mặc định TẮT (chỉ ghi log IP lạ để rà soát), Admin tự bật chặn thật khi đã sẵn sàng. Có nút "DNS Map Monitoring" liên kết ra trang giám sát Uptime Kuma tự triển khai riêng (xem `VITE_UPTIME_KUMA_URL` bên dưới).
- Dashboard, Audit Logs, Bulk actions — toàn bộ số liệu lấy trực tiếp từ PostgreSQL, không có dữ liệu giả lập.

## Yêu cầu

- Node.js ≥ 20
- PostgreSQL ≥ 14 (khuyến nghị 17)
- Docker + Docker Compose (nếu dùng cách cài đặt khuyến nghị bên dưới)

## Cài đặt nhanh — Docker Compose (khuyến nghị)

```bash
git clone <URL_REPO_CUA_BAN>.git cyberdns-tip
cd cyberdns-tip
cp .env.example .env
# Mở .env, đổi POSTGRES_PASSWORD và SUPERADMIN_PASSWORD sang giá trị thật
docker compose up -d --build
```

Sau khi container `app` khởi động xong (kiểm tra `docker compose logs -f app`), truy cập:

```
http://<ip-vps-cua-ban>:3000
```

Đăng nhập bằng `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` đã đặt trong `.env`. Đổi mật khẩu ngay sau lần đăng nhập đầu tiên (màn hình Người dùng & Phân quyền).

**Cập nhật lên phiên bản mới** (sau khi `git pull`):
```bash
docker compose up -d --build
```
Migration database (các file SQL đã review trong `drizzle/`) được áp dụng tự động mỗi lần container khởi động (`docker-entrypoint.sh` → `dist/migrate.cjs`) — cài đặt mới không cần thao tác gì thêm. **Lần đầu chuyển từ bản cũ (dùng `drizzle-kit push`) sang migration versioned**: chạy `npm run db:baseline` một lần trên database hiện có TRƯỚC khi deploy image mới. Quy trình đổi schema và chi tiết baseline: xem [`MIGRATION.md`](MIGRATION.md).

**Backup dữ liệu**: dữ liệu Postgres nằm trong Docker volume `cyberdns_pgdata`. Backup nhanh:
```bash
docker compose exec db pg_dump -U cyberdns_app cyberdns_tip > backup-$(date +%F).sql
```

## Cài đặt không dùng Docker (Ubuntu, cài trực tiếp)

Dùng script tự động (cài Node 20, PostgreSQL, tạo DB, build, đăng ký systemd service):

```bash
git clone <URL_REPO_CUA_BAN>.git cyberdns-tip
cd cyberdns-tip
chmod +x deploy/install-ubuntu.sh
./deploy/install-ubuntu.sh
```

Script an toàn để chạy lại nhiều lần (idempotent) — không ghi đè `.env` nếu đã tồn tại. Xem log service:

```bash
sudo systemctl status cyberdns-tip
sudo journalctl -u cyberdns-tip -f
```

## Đưa ra domain thật / HTTPS

Cả hai cách cài đặt trên đều chạy app ở cổng `3000`, chỉ lắng nghe trên `127.0.0.1` (không lộ ra ngoài Internet trực tiếp — xem chú thích trong `docker-compose.yml`). Để gắn domain thật + HTTPS miễn phí (Let's Encrypt) + tường lửa, chạy 1 lệnh cho mỗi domain (script nhận `<domain> [port] [tên-site]`, dùng chung cho cả TIP lẫn bất kỳ service local nào khác — có sẵn hỗ trợ WebSocket upgrade nên cũng dùng được cho Uptime Kuma):

```bash
chmod +x deploy/setup-domain-ssl.sh

# DNS: trỏ A record của tip.cyberdns.vn về đúng IP public của VPS trước
./deploy/setup-domain-ssl.sh tip.cyberdns.vn 3000 cyberdns-tip

# Nếu có chạy Uptime Kuma ở container riêng (host-map ra 127.0.0.1:18080) —
# trỏ A record của uptime.cyberdns.vn về VPS trước, rồi:
./deploy/setup-domain-ssl.sh uptime.cyberdns.vn 18080 uptime-kuma
```

Script này cài Nginx + Certbot (nếu chưa có), tạo vhost reverse-proxy, mở `ufw` chỉ cho 22/80/443 (chặn truy cập trực tiếp vào cổng app từ Internet — quan trọng để nhật ký đăng nhập ghi đúng IP thật, không bị giả mạo), và xin chứng chỉ SSL tự động gia hạn cho từng domain. Sau khi chạy xong, truy cập `https://tip.cyberdns.vn` (và `https://uptime.cyberdns.vn` nếu có chạy).

Muốn tự cấu hình thủ công hoặc dùng domain khác, xem `deploy/nginx.conf.example` (có sẵn cả 2 vhost mẫu ở trên làm tham khảo).

## Biến môi trường

Xem đầy đủ chú thích trong [`.env.example`](.env.example). Tóm tắt:

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `POSTGRES_PASSWORD` | Chỉ Docker Compose | Mật khẩu cho container `db` và để `docker-compose.yml` tự dựng `DATABASE_URL` |
| `DATABASE_URL` | Chỉ cài native | Chuỗi kết nối PostgreSQL đầy đủ |
| `DB_SSL` | Không | `true`/`false` — mặc định tắt cho host local, bật cho host khác |
| `PORT` | Không | Mặc định `3000` |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | Khuyến nghị | Tài khoản Admin đầu tiên, tự tạo nếu chưa có Admin nào |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_SECURE` / `SMTP_FROM` | Không | Máy chủ SMTP để gửi email cảnh báo đăng nhập IP mới — để trống `SMTP_HOST` để tắt tính năng này (cảnh báo trong ứng dụng vẫn hoạt động) |
| `SECURITY_ALERT_EMAIL` | Không | Địa chỉ nhận email cảnh báo đăng nhập từ IP mới |
| `VITE_UPTIME_KUMA_URL` | Không | URL trang Uptime Kuma tự triển khai riêng (đọc lúc **build**, không phải lúc chạy) — để trống thì nút "DNS Map Monitoring" hiện disabled thay vì trỏ tới đường dẫn không tồn tại |
| `PG_MAX_WAL_SIZE` / `PG_CHECKPOINT_TIMEOUT` / `PG_SHARED_BUFFERS` / `PG_EFFECTIVE_CACHE_SIZE` | Không (chỉ Docker Compose) | Tinh chỉnh hiệu năng PostgreSQL — mặc định an toàn cho VPS nhỏ, tăng thêm nếu VPS có nhiều RAM hơn (xem `.env.example`) |

## Kiến trúc & cấu trúc thư mục

- `server.ts` — Express server (API + phục vụ frontend đã build), điểm khởi động duy nhất.
- `src/db/schema.ts` — Drizzle schema, nguồn sự thật cho cấu trúc database.
- `src/db/queries.ts` — toàn bộ logic đọc/ghi database.
- `src/db/triggers.ts` — trigger PostgreSQL (đồng bộ cache danh mục/domain, chạy theo lô ở cấp câu lệnh để xử lý tốt lượng lớn dữ liệu).
- `src/components/` — giao diện React theo từng tab (Dashboard, Domain Explorer, Import, Review Queue, Releases, Sources, Audit Logs, User Management, DNS Nodes).
- `deploy/` — script cài đặt & cấu hình tham khảo cho VPS Ubuntu (`install-ubuntu.sh`, `setup-domain-ssl.sh`, `nginx.conf.example`, `cyberdns-tip.service.example`).

## Giới hạn đã biết (đang hoàn thiện)

- **Bản phát hành (Release pipeline)**: giao diện đã sẵn sàng nhưng chưa có quy trình tạo release thật (chưa có gì tự động chụp lại trạng thái blocklist thành 1 bản release) — tab này sẽ trống cho tới khi tính năng này được triển khai.
- **Hoàn tác (Rollback) trong Audit Logs**: nút bấm hiện báo rõ là chưa hỗ trợ tự động, thay vì giả lập thành công — cần chỉnh sửa thủ công qua Domain Explorer nếu cần đảo ngược một thao tác.
- Xuất dữ liệu (Export) áp dụng đúng bộ lọc/nhóm hiện tại nhưng chưa hỗ trợ chọn nhiều nhóm cùng lúc trong 1 lần xuất.

## Development

```bash
npm install
cp .env.example .env   # trỏ DATABASE_URL vào PostgreSQL local của bạn, đặt DB_SSL=false
npm run dev             # http://localhost:3000, hot state qua Vite middleware
```

```bash
npm run lint        # tsc --noEmit
npm test            # vitest (unit test cho feedParser, ssrfGuard, rateLimit, password)
npm run db:generate # sinh file migration SQL mới trong drizzle/ sau khi sửa schema.ts
npm run db:migrate  # áp dụng migration đang chờ vào database
npm run build && npm start  # chạy bản production giống hệt Docker/systemd
```

Chi tiết quy trình migration (đổi schema, baseline database cũ, rollback): [`MIGRATION.md`](MIGRATION.md).
