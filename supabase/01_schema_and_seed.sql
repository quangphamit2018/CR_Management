-- CR Management: Supabase SQL Editor / initial schema + seed
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.change_requests (
  id uuid primary key default gen_random_uuid(), cr_id text not null unique, title text not null,
  legacy_name text, folder_name text, application text, requester text, department text, request_date date,
  category text not null default 'Enhancement', priority text not null default 'Medium', summary text,
  status text not null default 'New', owner text, approval_date date, approval_status text default 'Pending',
  target_date date, mail_thread text, progress_text text, progress numeric(5,2) not null default 0 check (progress between 0 and 100),
  notes text, brd_ref text, fsd_ref text, quotation_ref text, uat_ref text, release_ref text,
  created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(), cr_id uuid not null references public.change_requests(id) on delete cascade,
  doc_type text not null check (doc_type in ('BRD','FSD','QUOTATION','OTHER')), title text not null,
  version text, status text default 'Draft', storage_path text, file_name text, mime_type text, file_size bigint,
  notes text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(), cr_id uuid not null references public.change_requests(id) on delete cascade,
  subject text, sender text, recipients text, cc text, received_at timestamptz, body text, message_id text,
  attachment_count integer not null default 0, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.uat_test_cases (
  id uuid primary key default gen_random_uuid(), cr_id uuid not null references public.change_requests(id) on delete cascade,
  test_case_id text, module text, scenario text not null, steps text, test_data text, expected_result text,
  actual_result text, status text not null default 'Not Started' check (status in ('Not Started','Pass','Fail','Blocked')),
  tester text, test_date date, business_signoff text, signoff_date date, defect_note text,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(), cr_id uuid not null references public.change_requests(id) on delete cascade,
  release_id text, name text not null, planned_date date, actual_date date, features text, environment text,
  deploy_plan text, rollback_plan text, owner text, go_live_checklist boolean not null default false, signoff_by text,
  signoff_date date, status text not null default 'Planned' check (status in ('Planned','Ready','Deployed','Rolled Back','Closed')),
  notes text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cr_timeline (
  id uuid primary key default gen_random_uuid(), cr_id uuid not null references public.change_requests(id) on delete cascade,
  activity text not null, occurred_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(), cr_id uuid not null references public.change_requests(id) on delete cascade,
  doc_type text not null default 'OTHER' check (doc_type in ('BRD','FSD','MAIL','QUOTATION','UAT','RELEASE','OTHER')),
  file_name text not null, storage_path text not null unique, mime_type text, file_size bigint, version text,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);

create index if not exists idx_cr_status on public.change_requests(status);
create index if not exists idx_cr_priority on public.change_requests(priority);
create index if not exists idx_cr_application on public.change_requests(application);
create index if not exists idx_cr_owner on public.change_requests(owner);
create index if not exists idx_cr_created_at on public.change_requests(created_at desc);
create index if not exists idx_documents_cr on public.documents(cr_id);
create index if not exists idx_emails_cr on public.emails(cr_id);
create index if not exists idx_uat_cr on public.uat_test_cases(cr_id);
create index if not exists idx_releases_cr on public.releases(cr_id);
create index if not exists idx_timeline_cr on public.cr_timeline(cr_id);
create index if not exists idx_attachments_cr on public.attachments(cr_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists trg_cr_updated_at on public.change_requests;
create trigger trg_cr_updated_at before update on public.change_requests for each row execute function public.set_updated_at();
drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at before update on public.documents for each row execute function public.set_updated_at();
drop trigger if exists trg_emails_updated_at on public.emails;
create trigger trg_emails_updated_at before update on public.emails for each row execute function public.set_updated_at();
drop trigger if exists trg_uat_updated_at on public.uat_test_cases;
create trigger trg_uat_updated_at before update on public.uat_test_cases for each row execute function public.set_updated_at();
drop trigger if exists trg_releases_updated_at on public.releases;
create trigger trg_releases_updated_at before update on public.releases for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,display_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing; return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.change_requests enable row level security;
alter table public.documents enable row level security;
alter table public.emails enable row level security;
alter table public.uat_test_cases enable row level security;
alter table public.releases enable row level security;
alter table public.cr_timeline enable row level security;
alter table public.attachments enable row level security;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select using (auth.uid()=id);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (auth.uid()=id);
do $$ declare t text; begin
  foreach t in array array['change_requests','documents','emails','uat_test_cases','releases','cr_timeline','attachments'] loop
    execute format('drop policy if exists %I_all_authenticated on public.%I', t, t);
    execute format('create policy %I_all_authenticated on public.%I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')', t, t);
  end loop;
end $$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('cr-files','cr-files',false,52428800,
array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel.sheet.macroEnabled.12','text/csv','message/rfc822','application/zip','image/png','image/jpeg'])
on conflict (id) do update set file_size_limit=52428800, public=false;

drop policy if exists cr_files_select on storage.objects;
create policy cr_files_select on storage.objects for select using (bucket_id='cr-files' and auth.role()='authenticated');
drop policy if exists cr_files_insert on storage.objects;
create policy cr_files_insert on storage.objects for insert with check (bucket_id='cr-files' and auth.role()='authenticated');
drop policy if exists cr_files_update on storage.objects;
create policy cr_files_update on storage.objects for update using (bucket_id='cr-files' and auth.role()='authenticated') with check (bucket_id='cr-files' and auth.role()='authenticated');
drop policy if exists cr_files_delete on storage.objects;
create policy cr_files_delete on storage.objects for delete using (bucket_id='cr-files' and auth.role()='authenticated');

insert into public.change_requests
(cr_id,title,legacy_name,folder_name,application,requester,department,request_date,category,priority,summary,status,owner,approval_date,approval_status,target_date,mail_thread,progress_text,notes,brd_ref,fsd_ref,quotation_ref,uat_ref,release_ref)
values
  ('CR_001','Auto SO-DN','Auto SO-DN','[CR_001] Auto SO-DN','DMS','SFA Team','DE','2026-09-03','Enhancement','Low',NULL,'UAT','Anh Hải','2026-09-03','Approved',NULL,'CR Submission– Auto SO-DN Enhancement Requirement','- Ngày 31/08/2026: Tiếp nhận đầy đủ BRD và FSD từ InterK','Đang đợi PR-PO

--> đợi devploy để test
logic chỉ kiểm tra lại 1 lần sau khi tăng tồn xem có đạt điều kiện không, nếu vẫn Failed thì phải manual','CCBVL_BRD001','CCBVL_FSD001',NULL,NULL,NULL),
  ('CR_002','Change default Filter to Order Date for SR report','Change default Filter to Order Date for SR report

Add new filter as "Order Type". "Normal" type filter will be defaulted filter for SO and SR. Add new POSM for this','[CR_002] Change default filter to Order Date for Sales Register','XnappReports','SFA Team','DE','2026-09-03','Enhancement','Low',NULL,'In Progress','Anh Hải','2026-09-03','Approved',NULL,'Clarification Required Hi Bevis,- Enhancement of Default Filters (Order Date & Order Type)','- Ngày 31/08/2026: Tiếp nhận BRD từ InterK → Liên hệ Vxceed để nhận file FSD','Đầu tháng 8 nhận FSD --> chưa share','CCBVL_BRD002','CCBVL_FSD002',NULL,NULL,NULL),
  ('CR_003','Create new Order Type = POSM on DMS','Create new Order Type = POSM on DMS','[CR_003] Add a POSM Order type','DMS','SFA Team','DE','2026-09-03','Enhancement','Low',NULL,'In Progress','Anh Hải','2026-09-03','Approved',NULL,'FSD for Review and Approval for Adding POSM Order Type','- Ngày 31/08/2026: Tiếp nhận đầy đủ BRD và FSD từ InterK','nằm ở mục Sale Order 
Lưu ý là tạo được đơn nhưng không settle được cho POSM và Sample không có setup giá
next action: có FSD --> gửi cho anh Hải xem
nếu approve thì tiến hành test case','CCBVL_BRD003','CCBVL_FSD003',NULL,NULL,NULL),
  ('CR_004','Distributor Warehouse separately with FOC & Finished Goods','Distributor Warehouse separately with FOC & Finished Goods','[CR_004] Split Distributor Warehouse Inventory','DMS','SFA Team','DE','2026-09-03','Enhancement','Low',NULL,'In Progress','Anh Hải','2026-09-03','Approved',NULL,'Clarification Required: [DMS] Inventory Split: FOC & Finished Goods for Distributors','- Ngày 31/08/2026: Tiếp nhận BRD từ InterK → Liên hệ Vxceed để nhận file FSD','PI có số 011xxxx là hàng FOC
12xxxx là hàng Finish good
--> Status mới nhất của 

ZOR --> Finishgood (sản phẩm bán)
YFRE -> FOC (sản phẩm tặng)

next action: sẽ hỏi chỗ anh Trường là cột SaTy có được gửi cho AIS --> gửi cho DMS hay không','CCBVL_BRD004','CCBVL_FSD004',NULL,NULL,NULL),
  ('CR_005','DMS Reporting Dashboard','DMS Reporting Dashboard','[CR_005] Enhancement DMS Reporting Dashboard','DMS','SFA Team','DE','2026-09-03','Enhancement','Low',NULL,'In Progress','Anh Hải','2026-09-03','Approved',NULL,'FW: Update on DMS Dashboard Reporting Changes
Trả lời: UAT - Sales Order Monitoring Report Enhancement in DMS Reporting','- Ngày 31/08/2026: Tiếp nhận BRD từ InterK → Liên hệ Vxceed để nhận file FSD','Đầu tháng 8 nhận FSD --> chưa share','CCBVL_BRD005','CCBVL_FSD005',NULL,NULL,NULL),
  ('CR_006','GRN & Pending intransit report','GRN & Pending intransit report','[CR_006] Add Amount Column To GRN And Pending Intransit Report','XnappReports','SFA Team','DE','2026-09-03','Enhancement','Low',NULL,'UAT','Anh Hải','2026-09-03','Approved',NULL,'Update on GRN Details Report Enhancement CR','- Ngày 31/08/2026: Tiếp nhận đầy đủ BRD và FSD từ InterK','next action: L2 testing
--> hỏi phía Vxceed tại sao cột Check out time toàn là 7h sáng','CCBVL_BRD006','CCBVL_FSD006',NULL,NULL,NULL),
  ('CR_007','PACE Sales Order mapped with DMS pricing','PACE Sales Order mapped with DMS pricing','[CR_007] Pace Sales Order Price Mapping With DMS Pricing','DMS','SFA Team','DE','2026-09-03','Enhancement','Low',NULL,'UAT','Anh Hải','2026-09-03','Approved',NULL,'CR Shared- [DMS-PACE] Auto DMS Pricing Mapping for PACE Orders','- Ngày 31/08/2026: Tiếp nhận đầy đủ BRD và FSD từ InterK','Ngày 14/08 đã release UAT
Next action: đã được release hay chưa
--> hỏi Vxceed

Test PACE QA --> Trường hợp 1: chọn sản phẩm null giá trên pace và có giá trên DMS | Trường hợp 2 là có giá trên pace và giá trên DMS khác nhau

Nếu mà DMS hiển thị giá của pace là failed (ở mục Posted)

SAu đó back với anh Hải','CCBVL_BRD007','CCBVL_FSD007',NULL,NULL,NULL),
  ('CR_008','Promotion Budget','Promotion Budget','[CR_008] Promotion Budget Requirement','DMS','SFA Team','DE','2026-09-03','Enhancement','Low',NULL,'On Hold','Anh Hải','2026-09-03',NULL,NULL,'FW: [DMS] Promotion Budget','- Ngày 31/08/2026: Tiếp nhận BRD từ InterK → Tạm thời chưa có FSD bởi vì CR_013 và CR_004 xong thì mới có FSD','đợi Template Sales Organization​ và Distributor Warehouse separately with FOC & Finished Goods​ xong --> lúc này mới có FSD
nằm ở mục Budget Managent (DMS Central)','CCBVL_BRD008','CCBVL_FSD008',NULL,NULL,NULL),
  ('CR_009','Promotion Slab in Slab','Promotion Slab in Slab','[CR_009] Promtion Slab in Slab','DMS','SFA Team','DE','2026-09-03','Enhancement','Low',NULL,'UAT','Anh Hải','2026-09-03','Approved',NULL,'Update on Promotion Slab in Slab CR – Revised ETA','- Ngày 31/08/2026: Tiếp nhận đầy đủ BRD và FSD từ InterK','1 FOC chỉ tính theo đơn vị EA, không cài được CS
--> Bảo fwd mail','CCBVL_BRD009','CCBVL_FSD009',NULL,NULL,NULL),
  ('CR_010','Purchase order ','Purchase order ','[CR_010] Requirement for Purchase Order','DMS','SFA Team','DE','2026-09-03','New Feature','Low',NULL,'In Review','Anh Hải','2026-09-03','Approved',NULL,'[DMS - requirement] : BRD Purchase Order
[DMS] Discuss on current future of Purchase Order','- Ngày 31/08/2026: Tiếp nhận BRD từ InterK → Chưa có submit BRD cho Vxceed nên chưa có FSD','Xem qua BRD mới và trao đổi với anh Hải để xem next step làm gì','CCBVL_BRD010','CCBVL_FSD010',NULL,NULL,NULL),
  ('CR_011','Route Auto Selection','Route Auto Selection
(SOV order)','[CR_011] Auto Route Mapping','DMS','SFA Team','DE','2026-09-03','Enhancement','Low',NULL,'Released','Anh Hải','2026-09-03','Approved','2026-08-04','FW: Update on Production Release – Latest Enhancement Changes & Auto Route Mapping CR .

FW: [DMS] UAT - Route auto selection

FW:  Route auto selection – Multiple route mapping for one customer- UAT Testing & Signoff Request','- Ngày 31/08/2026: Tiếp nhận đầy đủ BRD và FSD từ InterK → Đã deploy lên Production','#VALUE!','CCBVL_BRD011','CCBVL_FSD011',NULL,NULL,NULL),
  ('CR_012','Sales Order Monitoring report','Sales Order Monitoring report','[CR_012] SalesOrder Monitoring Report Enhancement_2.0','DMS','SFA Team','DE','2026-09-03','Enhancement','Low',NULL,'UAT','Anh Hải','2026-09-03','Approved',NULL,'UAT - Sales Order Monitoring Report Enhancement in DMS Reporting','- Ngày 31/08/2026: Tiếp nhận đầy đủ BRD và FSD từ InterK','hiện tại đang sai chỗ số lượng hàng thiếu EA
--> hỏi lại vxceed status','CCBVL_BRD012','CCBVL_FSD012',NULL,NULL,NULL),
  ('CR_013','Template Sales Organization','Template Sales Organization','[CR_013] Template Sales Organization','DMS','SFA Team','DE','2026-09-03','Enhancement','Low',NULL,'UAT','Anh Hải','2026-09-03','Approved',NULL,'[DMS] Template Sales Organization','- Ngày 31/08/2026: InterK cho biết rằng BRD và FSD không có bởi vì trên môi trường UAT đã có sẵn tính năng này rồi, chỉ cần enable UI trên môi trường UAT','không có BRD và FSD do có feature có sẵn
Vxceed enable trên UI của UAT','CCBVL_BRD013','CCBVL_FSD013',NULL,NULL,NULL)
on conflict (cr_id) do update set
title=excluded.title, legacy_name=excluded.legacy_name, folder_name=excluded.folder_name, application=excluded.application,
requester=excluded.requester, department=excluded.department, request_date=excluded.request_date, category=excluded.category,
priority=excluded.priority, summary=excluded.summary, status=excluded.status, owner=excluded.owner, approval_date=excluded.approval_date,
approval_status=excluded.approval_status, target_date=excluded.target_date, mail_thread=excluded.mail_thread, progress_text=excluded.progress_text,
notes=excluded.notes, brd_ref=excluded.brd_ref, fsd_ref=excluded.fsd_ref, quotation_ref=excluded.quotation_ref, uat_ref=excluded.uat_ref, release_ref=excluded.release_ref;

create or replace view public.cr_dashboard as
select status, priority, category, application, owner, count(*)::int as total, round(avg(progress),2) as avg_progress
from public.change_requests group by status, priority, category, application, owner;
