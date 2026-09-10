# Database migrations

CyberDNS TIP dùng **versioned migrations**: mỗi thay đổi schema là một file SQL
do người viết, được review, commit vào `drizzle/`, và áp dụng **đúng một lần**
theo thứ tự. Trạng thái đã-áp-dụng được lưu trong bảng
`drizzle.__drizzle_migrations` của chính database đó.

> **Vì sao không còn `drizzle-kit push` on-boot?**
> Bản cũ chạy `echo "Yes" | drizzle-kit push` trong `docker-entrypoint.sh` mỗi
> lần container khởi động. `push` so sánh `src/db/schema.ts` với database rồi
> **tự xác nhận** prompt của nó. Một thay đổi mà drizzle-kit xếp vào loại
> destructive (đổi tên cột = drop + add) sẽ **âm thầm xoá dữ liệu thật** ở lần
> restart kế tiếp — kể cả khi restart do crash-loop. Migration chỉ chạy đúng
> SQL mà một người đã viết và commit.

Các đối tượng KHÔNG nằm trong migration: extension / function / trigger /
partial-unique-index cho cache `domain_categories` và full-text search. Chúng
vẫn được `server.ts` tạo lại idempotent mỗi lần khởi động qua
`ensureDomainCategoryTriggers()` / `ensureSearchIndexes()` (`src/db/triggers.ts`).

---

## Quy trình đổi schema

1. Sửa `src/db/schema.ts`.
2. Sinh migration:
   ```bash
   npm run db:generate            # drizzle-kit generate
   ```
   Đặt tên rõ ràng khi được hỏi (hoặc `--name=...`). File mới xuất hiện ở
   `drizzle/NNNN_<tên>.sql` kèm snapshot trong `drizzle/meta/`.
3. **Đọc lại file SQL vừa sinh.** Nếu nó `DROP`, đổi kiểu cột, hay thêm `NOT NULL`
   vào cột đang có dữ liệu — sửa tay thành các bước an toàn (thêm cột nullable →
   backfill → set NOT NULL trong migration sau, v.v.).
4. Áp dụng vào database local để thử:
   ```bash
   npm run db:migrate
   ```
5. Commit **cả** `src/db/schema.ts` **và** toàn bộ `drizzle/` (kể cả `meta/`).
6. Deploy như thường (`docker compose up -d --build`). `docker-entrypoint.sh`
   chạy `dist/migrate.cjs` trước khi server start; chỉ các file mới được áp dụng.

`npm run db:migrate` (và `dist/migrate.cjs`) dùng đúng cấu hình kết nối +
SSL của `src/db/index.ts` — không có bộ thiết lập DB thứ hai.

---

## Lần đầu cut-over trên database ĐANG CHẠY (bắt buộc, làm đúng một lần)

Database production hiện tại đã có sẵn đầy đủ bảng (do `drizzle-kit push` tạo
dần trước đây). Migration `0000_baseline_schema.sql` mô tả **đúng** trạng thái
đó. Cần đánh dấu nó là "đã áp dụng" mà KHÔNG chạy lại SQL — nếu không,
`db:migrate` sẽ thử `CREATE TABLE` trên bảng đã tồn tại và lỗi.

**Trước khi deploy image có thay đổi này**, từ máy có thể kết nối tới DB
production (dùng role có quyền tạo schema — thường là user ứng dụng nếu nó đang
tự tạo trigger/function, hoặc user admin của DB):

```bash
# Docker Compose deploy — chạy trên VPS, trong thư mục chứa docker-compose.yml.
# Build image trước (docker compose build) để có dist/baseline.cjs:
docker compose run --rm \
  -e DATABASE_URL="postgres://cyberdns_app:${POSTGRES_PASSWORD}@db:5432/cyberdns_tip" \
  -e DB_SSL=false \
  app node dist/baseline.cjs

# Native install (systemd) — từ thư mục repo đã `npm ci`:
set -a; source .env; set +a
npm run db:baseline

# Managed DB (Neon/RDS/…):
DATABASE_URL='postgres://…' DB_SSL=true npm run db:baseline
```

`db:baseline` sẽ:
- kiểm tra `public.domains` tồn tại (nếu không → coi là DB mới, **từ chối** và
  bảo bạn chạy `db:migrate`);
- kiểm tra `drizzle.__drizzle_migrations` còn rỗng (nếu đã có dòng → **không làm gì**);
- tạo `drizzle.__drizzle_migrations` và chèn một dòng cho **mỗi** file trong
  `drizzle/` với `hash` + `created_at` khớp journal — tất cả trong một transaction.

Sau đó deploy image mới; `dist/migrate.cjs` on-boot sẽ báo *"database is up to
date"* và không đụng gì tới schema. Từ lần này trở đi chỉ migration MỚI chạy.

### Database mới hoàn toàn (fresh install)

Không chạy `db:baseline`. `dist/migrate.cjs` on-boot (hoặc `npm run db:migrate`)
tự tạo toàn bộ schema từ `0000_baseline_schema.sql`.

---

## Rollback

Migration là **forward-only** — không có file "down". Để lùi:

1. Luôn có backup trước khi deploy thay đổi schema:
   ```bash
   docker compose exec db pg_dump -U cyberdns_app cyberdns_tip > backup-$(date +%F).sql
   ```
2. Nếu một migration gây sự cố: restore từ backup, hoặc viết một migration
   **mới** đảo ngược thay đổi (rồi generate + commit + deploy như thường).
3. `migrate()` chạy toàn bộ các file đang chờ trong **một transaction** — nếu
   một câu lệnh lỗi, cả lượt đó rollback và server không khởi động (exit code
   khác 0 dừng `docker-entrypoint.sh`).

---

## `npm run db:push` còn lại để làm gì?

Chỉ cho vòng lặp dev nhanh trên database local dùng-một-lần (prototype schema
chưa muốn sinh file migration). **Không bao giờ** dùng trên staging/production
và không nằm trên đường khởi động container nữa.
