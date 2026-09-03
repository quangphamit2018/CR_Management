-- ===========================================================================
-- CR Management — kiểm tra sau khi chạy 01_schema_and_seed.sql
-- Chạy từng khối trong Supabase SQL Editor. File này chỉ ĐỌC, không thay đổi
-- dữ liệu, nên chạy lại bao nhiêu lần cũng an toàn.
-- ===========================================================================

-- 1) Đủ 8 bảng chưa?
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles','change_requests','documents','emails',
                     'uat_test_cases','releases','cr_timeline','attachments')
order by table_name;
-- Kỳ vọng: 8 dòng.

-- 2) RLS đã bật trên tất cả các bảng chưa?
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('profiles','change_requests','documents','emails',
                  'uat_test_cases','releases','cr_timeline','attachments')
order by relname;
-- Kỳ vọng: rls_enabled = true ở mọi dòng.

-- 3) Policy nào đang áp lên các bảng?
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
-- Kỳ vọng: mỗi bảng nghiệp vụ có 1 policy *_all_authenticated (cmd = ALL).

-- 4) Dữ liệu seed đã vào chưa?
select count(*) as so_change_request from public.change_requests;
-- Kỳ vọng: 13 (CR_001 .. CR_013) nếu chưa đồng bộ thêm từ Excel.

select cr_id, title, status, priority, progress, owner
from public.change_requests
order by cr_id;

-- 5) Bucket Storage đã tạo chưa?
select id, name, public, file_size_limit
from storage.buckets
where id = 'cr-files';
-- Kỳ vọng: 1 dòng, public = false, file_size_limit = 52428800.

-- 6) Policy trên storage.objects?
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname like 'cr_files%'
order by policyname;
-- Kỳ vọng: 4 dòng (select / insert / update / delete).

-- 7) Đã có user nào để đăng nhập chưa?
select id, email, email_confirmed_at, created_at
from auth.users
order by created_at desc
limit 10;
-- Nếu rỗng: vào Authentication > Users > Add user, BẬT "Auto Confirm User".
-- Nếu email_confirmed_at là NULL: user chưa xác nhận nên KHÔNG đăng nhập được.

-- 8) Tổng hợp nhanh theo trạng thái (đối chiếu với dashboard của app)
select status,
       count(*)                    as so_luong,
       round(avg(progress), 1)     as tien_do_tb
from public.change_requests
group by status
order by so_luong desc;

-- 9) Số bản ghi con đang có
select 'documents'      as bang, count(*) from public.documents
union all select 'emails',         count(*) from public.emails
union all select 'uat_test_cases', count(*) from public.uat_test_cases
union all select 'releases',       count(*) from public.releases
union all select 'cr_timeline',    count(*) from public.cr_timeline
order by 1;

-- ===========================================================================
-- KHẮC PHỤC SỰ CỐ
-- ===========================================================================
-- • App đăng nhập được nhưng bảng trống, không báo lỗi
--   -> RLS chặn. Kiểm tra khối (3). Policy phải là auth.role() = 'authenticated'.
--
-- • Lỗi "new row violates row-level security policy" khi thêm/sửa
--   -> Phiên đăng nhập đã hết hạn. Đăng xuất rồi đăng nhập lại.
--
-- • Lỗi 'invalid input syntax for type date: ""'
--   -> Không xảy ra khi ghi từ app (đã tự đổi chuỗi rỗng thành NULL),
--      nhưng sẽ xảy ra nếu bạn INSERT tay. Dùng NULL thay vì ''.
--
-- • Upload file báo "new row violates row-level security policy" trên storage
--   -> Kiểm tra khối (6). Thiếu policy thì chạy lại phần cuối của
--      01_schema_and_seed.sql.
--
-- • Lỗi 'duplicate key value violates unique constraint change_requests_cr_id_key'
--   -> Mã CR đã tồn tại. Sửa bản ghi cũ thay vì tạo mới, hoặc đổi mã CR.
