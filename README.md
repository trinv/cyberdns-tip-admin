# CyberDNS TIP

Threat Intelligence & Domain Blocklist management platform — sync domain blocklists from feed sources (or import manually), organize them into categories, review/approve before blocking, and browse/export the result. Built with React 19 + Vite, a single Express server, and PostgreSQL (Drizzle ORM).

## Tính năng chính

- **Đồng bộ nguồn feed thật**: kéo toàn bộ nội dung từ URL feed (hỗ trợ định dạng hosts-file và AdBlock/uBlock), phân tích, loại trùng, ghi vào PostgreSQL theo lô — không giới hạn số lượng domain/lần đồng bộ. Tiến trình % chạy nền ở server, không mất khi chuyển tab.
- **Tùy chọn "yêu cầu xác nhận thủ công"** cho từng nguồn feed: domain mới phát hiện có thể vào Hàng đợi duyệt (Review Queue) thay vì tự động chặn ngay.
- **Mỗi tên miền chỉ thuộc đúng 1 danh mục** — thực thi ở tầng database (unique constraint + trigger), không thể trùng lặp phân loại.
- **Domain Explorer**: lọc/sắp xếp/phân trang phía server, xuất toàn bộ danh mục (không giới hạn theo trang) ra .txt/.csv/.hosts/.rpz/AdBlock/dnsmasq.
- **Quản lý người dùng & phân quyền** tự host (email/mật khẩu, không phụ thuộc Google/Firebase), tài khoản Super Admin tự tạo khi khởi động lần đầu nếu chưa có Admin nào. Toàn bộ ứng dụng yêu cầu đăng nhập — chưa xác thực chỉ thấy trang đăng nhập, không vào thẳng được Dashboard.
- **Nhật ký đăng nhập & cảnh báo IP mới**: mọi lượt đăng nhập (thành công lẫn thất bại) đều ghi lại IP thật + trình duyệt (qua Nginx `X-Forwarded-For`); đăng nhập từ IP chưa từng dùng sẽ hiện cảnh báo ngay trong ứng dụng, và Admin xem được toàn bộ lịch sử ở mục "Nhật ký đăng nhập".
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
Schema database được áp dụng tự động mỗi lần container khởi động (xem `docker-entrypoint.sh`) — không cần chạy migration thủ công cho việc cài đặt/cập nhật thông thường. Với thay đổi schema có khả năng phá hủy dữ liệu, hãy xem trước bằng `docker compose run --rm app npm run db:push` trước khi rollout.

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

Cả hai cách cài đặt trên đều chạy app ở cổng `3000`, chỉ lắng nghe trên `127.0.0.1` (không lộ ra ngoài Internet trực tiếp — xem chú thích trong `docker-compose.yml`). Để gắn domain thật (`tipadmin.cyberdns.vn`) + HTTPS miễn phí (Let's Encrypt) + tường lửa, chạy 1 lệnh:

```bash
# DNS: trỏ A record của tipadmin.cyberdns.vn về đúng IP public của VPS trước
chmod +x deploy/setup-domain-ssl.sh
./deploy/setup-domain-ssl.sh tipadmin.cyberdns.vn
```

Script này cài Nginx + Certbot (nếu chưa có), tạo vhost reverse-proxy, mở `ufw` chỉ cho 22/80/443 (chặn truy cập trực tiếp vào cổng 3000 từ Internet — quan trọng để nhật ký đăng nhập ghi đúng IP thật, không bị giả mạo), và xin chứng chỉ SSL tự động gia hạn. Sau khi chạy xong, truy cập `https://tipadmin.cyberdns.vn`.

Muốn tự cấu hình thủ công hoặc dùng domain khác, xem `deploy/nginx.conf.example`.

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
| `PG_MAX_WAL_SIZE` / `PG_CHECKPOINT_TIMEOUT` / `PG_SHARED_BUFFERS` / `PG_EFFECTIVE_CACHE_SIZE` | Không (chỉ Docker Compose) | Tinh chỉnh hiệu năng PostgreSQL — mặc định an toàn cho VPS nhỏ, tăng thêm nếu VPS có nhiều RAM hơn (xem `.env.example`) |

## Kiến trúc & cấu trúc thư mục

- `server.ts` — Express server (API + phục vụ frontend đã build), điểm khởi động duy nhất.
- `src/db/schema.ts` — Drizzle schema, nguồn sự thật cho cấu trúc database.
- `src/db/queries.ts` — toàn bộ logic đọc/ghi database.
- `src/db/triggers.ts` — trigger PostgreSQL (đồng bộ cache danh mục/domain, chạy theo lô ở cấp câu lệnh để xử lý tốt lượng lớn dữ liệu).
- `src/components/` — giao diện React theo từng tab (Dashboard, Domain Explorer, Import, Review Queue, Releases, Sources, Audit Logs, User Management).
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
npm run lint    # tsc --noEmit
npm run db:push # áp dụng schema hiện tại (xem trước output trước khi xác nhận)
npm run build && npm start  # chạy bản production giống hệt Docker/systemd
```
