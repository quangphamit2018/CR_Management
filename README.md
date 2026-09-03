# CR Management

Ứng dụng quản lý Change Request: React 19 + Vite 7 + Tailwind 4, dữ liệu nằm trực tiếp trên Supabase (PostgREST + Auth + Storage). Không có backend riêng, deploy như một SPA tĩnh trên Vercel.

---

## 1. Chuẩn bị Supabase (làm một lần)

1. Mở **SQL Editor** trong project Supabase, dán và chạy toàn bộ `supabase/01_schema_and_seed.sql`.
   Script tạo 8 bảng, index, trigger `updated_at`, policy RLS, bucket riêng tư `cr-files` và seed 13 bản ghi CR_001–CR_013.

2. Tạo tài khoản đăng nhập: **Authentication → Users → Add user**.
   **Bắt buộc bật "Auto Confirm User"**, nếu không tài khoản sẽ ở trạng thái chưa xác nhận và không đăng nhập được.

3. Chạy `supabase/02_checks.sql` để đối chiếu: đủ 8 bảng, RLS bật, 13 bản ghi, bucket tồn tại, user đã confirm.

RLS hiện tại cho phép mọi người đã đăng nhập (`auth.role() = 'authenticated'`) đọc/ghi toàn bộ dữ liệu nghiệp vụ. Khi mở rộng cho nhiều nhóm, thay policy `*_all_authenticated` bằng policy theo phòng ban hoặc theo `owner`.

---

## 2. Chạy tại máy

```bash
npm install
cp .env.example .env.local      # điền VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                     # http://localhost:5173
```

Các lệnh khác:

| Lệnh | Tác dụng |
|---|---|
| `npm run build` | Build production ra `dist/` |
| `npm run typecheck` | `tsc --noEmit`, không sinh file |
| `npm run preview` | Xem thử bản build |
| `npm run sync:excel -- --file ./tracker.xlsm --inspect` | Đồng bộ Excel (mục 5) |

Nếu không đặt biến môi trường, app dùng URL và anon key mặc định ghi trong `src/lib/supabase.ts`. Đặt biến môi trường sẽ ghi đè giá trị mặc định này.

---

## 3. Deploy lên Vercel

**Import repo → Vercel tự nhận Framework = Vite.** File `vercel.json` đã khai báo sẵn:

- Build Command: `npm run build`
- Output Directory: `dist`
- Rewrite mọi đường dẫn về `/index.html` (trừ `assets/`, `favicon.svg`, `robots.txt`) để routing client-side của wouter hoạt động khi F5 giữa chừng.

Environment Variables cần thêm cho **Production và Preview**:

| Biến | Giá trị |
|---|---|
| `VITE_SUPABASE_URL` | `https://rnsjiqbbeywgbnqsojce.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon / publishable key |

Không khai báo `SUPABASE_SERVICE_ROLE_KEY`, `SYNC_EMAIL`, `SYNC_PASSWORD` trên Vercel. Chúng chỉ dùng cho script chạy tại máy.

Sau khi deploy, thêm domain Vercel vào **Supabase → Authentication → URL Configuration → Redirect URLs** để luồng đăng nhập không bị chặn.

---

## 4. Chức năng

**Đăng nhập** — email + mật khẩu qua Supabase Auth, phiên lưu ở `localStorage`, tự refresh token. Đăng xuất ở góc phải header hoặc trong trang Workspace.

**Control room** — tổng số CR, tiến độ trung bình, số Critical + High, trạng thái kết nối; pipeline theo trạng thái; phân bổ theo ứng dụng / người phụ trách / phân loại / mức ưu tiên; hoạt động gần đây lấy từ `cr_timeline` (nếu bảng còn trống thì suy ra từ các CR cập nhật gần nhất).

**Sổ đăng ký** — tìm kiếm trên 6 cột (`cr_id`, `title`, `application`, `owner`, `requester`, `legacy_name`), lọc theo trạng thái và mức ưu tiên, sắp xếp theo mã CR / cập nhật gần nhất / ngày mục tiêu / tiến độ. Xoá có hỏi xác nhận.

**Chi tiết CR** — sửa toàn bộ 20 trường của `change_requests`, và **thêm / sửa / xoá trực tiếp trên UI** cho cả 5 bảng con:

| Tab | Bảng | Ghi chú |
|---|---|---|
| Hồ sơ | `documents` | có đính kèm file |
| Mail | `emails` | |
| UAT | `uat_test_cases` | |
| Release | `releases` | |
| Timeline | `cr_timeline` | app cũng tự ghi log khi tạo/sửa CR |

**Đính kèm file** — upload vào bucket riêng tư `cr-files`, đường dẫn `<cr_uuid>/<doc_type>/<timestamp>_<tên_file>`. Tên file tiếng Việt được bỏ dấu để đường dẫn an toàn, nhưng tên hiển thị giữ nguyên bản gốc. Bucket là private nên tải file qua **signed URL hạn 5 phút**, sinh mỗi lần bấm. Giới hạn 50 MB, chỉ nhận PDF, Word, Excel, CSV, `.eml`, `.zip`, PNG, JPEG — đúng theo `allowed_mime_types` khai báo trong SQL. Xoá bản ghi hồ sơ sẽ xoá luôn object trên Storage; huỷ dialog sau khi đã upload cũng dọn file thừa.

---

## 5. Đồng bộ Excel → Supabase

`scripts/sync-excel.mjs` đọc file `.xlsx`/`.xlsm`, tự dò dòng tiêu đề trong 15 dòng đầu, ánh xạ cột theo bảng alias (không phân biệt dấu tiếng Việt và hoa/thường), rồi upsert vào `change_requests` theo khoá `cr_id`.

**Luôn chạy `--inspect` trước** để xác nhận ánh xạ cột:

```bash
npm run sync:excel -- --file ./CR_Tracker.xlsm --inspect
```

Lệnh in ra dòng tiêu đề đã nhận, từng cột Excel ứng với cột nào trong DB, cột DB không tìm thấy, và cột Excel không nhận diện được. Nếu ánh xạ sai, sửa `COLUMN_ALIASES` ở đầu file script rồi chạy lại.

```bash
npm run sync:excel -- --file ./CR_Tracker.xlsm --dry-run   # in payload, không ghi
npm run sync:excel -- --file ./CR_Tracker.xlsm             # ghi thật
```

| Cờ | Tác dụng |
|---|---|
| `--file <path>` | Bắt buộc |
| `--sheet <name>` | Mặc định lấy sheet đầu tiên |
| `--inspect` | Chỉ in ánh xạ cột |
| `--dry-run` | In payload, không ghi DB |
| `--skip-empty` | Ô trống giữ nguyên giá trị cũ trong DB |
| `--limit <n>` | Chỉ xử lý n dòng đầu |

Mặc định **Excel là nguồn chuẩn**: ô trống sẽ ghi đè cột tương ứng thành `NULL`. Dùng `--skip-empty` nếu muốn Excel chỉ bổ sung chứ không xoá dữ liệu đã nhập trên app.

Quy tắc chuyển đổi giá trị:

- Ngày: nhận `dd/mm/yyyy`, `dd-mm-yyyy`, `yyyy-mm-dd`, ô định dạng Date của Excel, và cả serial number. Không parse được thì ghi `NULL`.
- Tiến độ: `"80%"` → `80`. Giá trị trong khoảng `(0, 1]` được hiểu là tỷ lệ phần trăm (`0.35` → `35`, `1` → `100`) và script in cảnh báo liệt kê từng ô đã quy đổi để bạn kiểm tra lại.
- `#VALUE!`, `#N/A`, ô trống → `NULL`.
- Dòng không có mã CR: bỏ qua. Dòng có mã CR nhưng thiếu tiêu đề: bỏ qua và báo tên, vì `title` là cột `NOT NULL`.

Xác thực cho script, đặt trong `.env.local`, chọn một trong hai:

- `SYNC_EMAIL` + `SYNC_PASSWORD` — đăng nhập bằng tài khoản thường, chạy đúng quyền `authenticated` như RLS quy định. Khuyến nghị.
- `SUPABASE_SERVICE_ROLE_KEY` — bỏ qua RLS, nhanh hơn nhưng toàn quyền trên DB. Chỉ để trên máy cá nhân, không commit, không đưa lên Vercel.

---

## 6. Cấu trúc thư mục

```
src/
  lib/
    supabase.ts        khởi tạo client, đọc env, chuẩn hoá lỗi
    auth.tsx           AuthProvider + useAuth
    api.ts             toàn bộ query/mutation React Query
    types.ts           kiểu dữ liệu bám sát schema Postgres
    child-schema.ts    khai báo field cho 5 bảng con
    storage.ts         upload, signed URL, xoá file
  components/
    auth-gate.tsx          màn hình đăng nhập
    cr-ui.tsx              Shell, badge, stat card, empty/error state
    change-request-form.tsx
    child-record-dialog.tsx  dialog thêm/sửa dùng chung cho bảng con
    ui/                    shadcn/ui
  pages/                dashboard, change-requests, detail, new, settings, 404
scripts/sync-excel.mjs
supabase/
  01_schema_and_seed.sql
  02_checks.sql
```

Muốn thêm một cột vào bảng con: thêm cột trong Postgres, rồi khai báo một `FieldDef` trong `src/lib/child-schema.ts`. Dialog và payload tự cập nhật theo, không phải sửa chỗ nào khác.

---

## 7. Ghi chú bảo mật

- Anon / publishable key nằm trong bundle trình duyệt là đúng thiết kế của Supabase. Rào chắn thật là RLS, nên đừng nới policy nếu chưa cân nhắc kỹ.
- Service role key **không bao giờ** được đặt vào biến `VITE_*` hay khai báo trên Vercel — nó bỏ qua toàn bộ RLS.
- Bucket `cr-files` là private. Không có đường dẫn công khai; mọi lượt tải đều qua signed URL 5 phút.
- `.gitignore` đã loại `.env` và `.env.local`.
- `VITE_ALLOW_ANON=true` bỏ qua màn hình đăng nhập. Với RLS hiện tại, bật cờ này chỉ dẫn đến màn hình trắng dữ liệu chứ không mở quyền — trừ khi bạn tự thêm policy cho role `anon`, và khi đó bất kỳ ai có URL đều đọc/ghi được.
