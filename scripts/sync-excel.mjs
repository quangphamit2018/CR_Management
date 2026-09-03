#!/usr/bin/env node
/**
 * Đồng bộ tracker Excel (.xlsx / .xlsm) sang bảng public.change_requests.
 *
 *   node scripts/sync-excel.mjs --file ./CR_Tracker.xlsm --inspect
 *   node scripts/sync-excel.mjs --file ./CR_Tracker.xlsm --dry-run
 *   node scripts/sync-excel.mjs --file ./CR_Tracker.xlsm
 *
 * Cờ:
 *   --file <path>     Bắt buộc. Đường dẫn file Excel.
 *   --sheet <name>    Tên sheet. Mặc định lấy sheet đầu tiên.
 *   --inspect         Chỉ in ra header đọc được và ánh xạ cột, không ghi gì.
 *   --dry-run         In payload sẽ gửi lên nhưng không ghi vào DB.
 *   --skip-empty      Ô trống thì giữ nguyên giá trị cũ trong DB (mặc định:
 *                     ô trống sẽ ghi đè thành NULL, tức Excel là nguồn chuẩn).
 *   --limit <n>       Chỉ xử lý n dòng đầu (để thử).
 *
 * Xác thực (chọn 1 trong 2, đặt trong .env.local hoặc biến môi trường):
 *   A. SUPABASE_SERVICE_ROLE_KEY  — bỏ qua RLS, nhanh gọn.
 *      TUYỆT ĐỐI chỉ để trên máy cá nhân / CI, không bao giờ đưa lên frontend.
 *   B. SYNC_EMAIL + SYNC_PASSWORD — đăng nhập bằng tài khoản thường,
 *      chạy dưới quyền `authenticated` đúng như RLS đã cấu hình.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

/* ------------------------------------------------------------------ */
/* Tham số dòng lệnh                                                   */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const args = { flags: new Set(), values: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.values[key] = next;
      i += 1;
    } else {
      args.flags.add(key);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const INSPECT = args.flags.has('inspect');
const DRY_RUN = args.flags.has('dry-run');
const SKIP_EMPTY = args.flags.has('skip-empty');
const LIMIT = args.values.limit ? Number(args.values.limit) : Infinity;

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Đọc .env.local / .env                                               */
/* ------------------------------------------------------------------ */

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
loadEnvFile(path.join(root, '.env.local'));
loadEnvFile(path.join(root, '.env'));

/* ------------------------------------------------------------------ */
/* Ánh xạ cột Excel -> cột Postgres                                    */
/* ------------------------------------------------------------------ */

/** Chuẩn hoá tên cột: bỏ dấu, bỏ ký tự lạ, viết thường. */
function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Alias cho từng cột đích. Danh sách này là phỏng đoán dựa trên tên cột
 * trong bảng public.change_requests và cách đặt tên thường gặp;
 * chạy `--inspect` để xác nhận với file thật rồi bổ sung alias nếu thiếu.
 */
const COLUMN_ALIASES = {
  cr_id: ['crid', 'cr', 'macr', 'socr', 'crno', 'crcode', 'crnumber', 'id'],
  title: ['title', 'tieude', 'tenyeucau', 'crtitle', 'requesttitle', 'ten', 'subject'],
  legacy_name: ['legacyname', 'tencu', 'tengoc', 'oldname', 'legacy'],
  folder_name: ['foldername', 'tenthumuc', 'thumuc', 'folder'],
  application: ['application', 'app', 'ungdung', 'hethong', 'system'],
  requester: ['requester', 'nguoiyeucau', 'nguoidenghi', 'bophanyeucau', 'requestedby'],
  department: ['department', 'phongban', 'bophan', 'dept'],
  request_date: ['requestdate', 'ngayyeucau', 'ngaydenghi', 'ngaytao', 'datecreated'],
  category: ['category', 'phanloai', 'loai', 'type', 'crtype'],
  priority: ['priority', 'mucuutien', 'uutien', 'doouutien', 'mucdouutien'],
  summary: ['summary', 'tomtat', 'mota', 'description'],
  status: ['status', 'trangthai', 'tinhtrang', 'crstatus'],
  owner: ['owner', 'phutrach', 'nguoiphutrach', 'pic', 'assignedto', 'nguoithuchien'],
  approval_date: ['approvaldate', 'ngayduyet', 'ngaypheduyet', 'ngayapprove'],
  approval_status: ['approvalstatus', 'trangthaiduyet', 'trangthaipheduyet', 'pheduyet', 'approval'],
  target_date: ['targetdate', 'ngaymuctieu', 'ngaydukien', 'duedate', 'deadline', 'eta'],
  mail_thread: ['mailthread', 'mailheader', 'tieudemail', 'luongmail', 'mail', 'email'],
  progress_text: ['progresstext', 'dienguaitiendo', 'tiendochitiet', 'capnhat', 'update', 'progressnote'],
  progress: ['progress', 'tiendo', 'percent', 'phantram', 'hoanthanh', 'complete'],
  notes: ['notes', 'ghichu', 'note', 'remark', 'nextaction', 'luuy'],
  brd_ref: ['brdref', 'brd', 'mabrd', 'sobrd'],
  fsd_ref: ['fsdref', 'fsd', 'mafsd'],
  quotation_ref: ['quotationref', 'quotation', 'baogia', 'maquotation'],
  uat_ref: ['uatref', 'uat', 'mauat'],
  release_ref: ['releaseref', 'release', 'marelease'],
};

const DATE_COLUMNS = new Set(['request_date', 'approval_date', 'target_date']);
const NUMERIC_COLUMNS = new Set(['progress']);

/** Với mỗi ô header, tìm cột đích khớp. */
function matchColumn(header) {
  const key = normalize(header);
  if (!key) return null;
  for (const [target, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(key)) return target;
  }
  // Khớp lỏng: header chứa alias (VD "crid2026" -> cr_id)
  for (const [target, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((alias) => alias.length >= 4 && key.startsWith(alias))) return target;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Đọc và chuyển đổi giá trị                                           */
/* ------------------------------------------------------------------ */

function toIsoDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  const text = String(value).trim();
  if (!text) return null;

  // Excel serial number
  if (/^\d+(\.\d+)?$/.test(text)) {
    const parsed = XLSX.SSF.parse_date_code(Number(text));
    if (parsed && parsed.y) {
      const pad = (n) => String(n).padStart(2, '0');
      return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
    }
  }
  // dd/mm/yyyy hoặc dd-mm-yyyy
  const dmy = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  return null;
}

const progressWarnings = [];

function toProgress(value, crId) {
  if (value === null || value === undefined || value === '') return 0;
  const text = String(value).trim().replace('%', '').replace(',', '.');
  const num = Number(text);
  if (!Number.isFinite(num)) return 0;
  if (num > 0 && num <= 1) {
    progressWarnings.push(`${crId}: ${value} -> ${num * 100}%`);
    return Math.round(num * 100 * 100) / 100;
  }
  return Math.min(100, Math.max(0, Math.round(num * 100) / 100));
}

function toText(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return toIsoDate(value);
  const text = String(value).trim();
  return text === '' || text === '#VALUE!' || text === '#N/A' ? null : text;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

const file = args.values.file;
if (!file) fail('Thiếu --file. Ví dụ: node scripts/sync-excel.mjs --file ./CR_Tracker.xlsm --inspect');
if (!fs.existsSync(file)) fail(`Không tìm thấy file: ${file}`);

const workbook = XLSX.read(fs.readFileSync(file), { cellDates: true });
const sheetName = args.values.sheet ?? workbook.SheetNames[0];
if (!workbook.Sheets[sheetName]) {
  fail(`Không có sheet "${sheetName}". Các sheet có sẵn: ${workbook.SheetNames.join(', ')}`);
}

const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
  header: 1,
  blankrows: false,
  defval: null,
});

if (grid.length === 0) fail(`Sheet "${sheetName}" rỗng.`);

// Tìm dòng header: dòng nào trong 15 dòng đầu ánh xạ được nhiều cột nhất
// và có chứa cột cr_id.
let headerIndex = -1;
let headerMap = null;
let bestScore = 0;

for (let i = 0; i < Math.min(15, grid.length); i += 1) {
  const row = grid[i] ?? [];
  const map = {};
  for (let c = 0; c < row.length; c += 1) {
    const target = matchColumn(row[c]);
    if (target && !(target in map)) map[target] = c;
  }
  const score = Object.keys(map).length;
  if (map.cr_id !== undefined && score > bestScore) {
    bestScore = score;
    headerIndex = i;
    headerMap = map;
  }
}

if (headerIndex === -1) {
  console.error('\n✗ Không xác định được dòng tiêu đề (không tìm thấy cột mã CR).');
  console.error('  15 dòng đầu của sheet:');
  grid.slice(0, 15).forEach((row, i) => {
    console.error(`  [${i}] ${(row ?? []).slice(0, 12).map((c) => String(c ?? '')).join(' | ')}`);
  });
  console.error('\n  Bổ sung alias vào COLUMN_ALIASES trong scripts/sync-excel.mjs rồi chạy lại.\n');
  process.exit(1);
}

const headerRow = grid[headerIndex] ?? [];
const mappedTargets = Object.keys(headerMap);
const unmapped = headerRow
  .map((cell, index) => ({ cell, index }))
  .filter(({ cell, index }) => cell && !Object.values(headerMap).includes(index))
  .map(({ cell }) => String(cell).trim());

console.log(`\nFile   : ${path.basename(file)}`);
console.log(`Sheet  : ${sheetName}`);
console.log(`Header : dòng Excel số ${headerIndex + 1}`);
console.log(`\nĐã ánh xạ ${mappedTargets.length} cột:`);
for (const [target, col] of Object.entries(headerMap)) {
  console.log(`  ${String(target).padEnd(16)} <- cột ${XLSX.utils.encode_col(col)} "${String(headerRow[col]).trim()}"`);
}
const missing = Object.keys(COLUMN_ALIASES).filter((key) => !(key in headerMap));
if (missing.length) console.log(`\nCột DB không tìm thấy trong Excel (sẽ bỏ qua): ${missing.join(', ')}`);
if (unmapped.length) console.log(`Cột Excel không nhận diện được (sẽ bỏ qua): ${unmapped.join(', ')}`);

if (INSPECT) {
  console.log('\n✓ Chế độ --inspect: không ghi gì vào DB.');
  console.log('  Nếu ánh xạ sai, sửa COLUMN_ALIASES trong scripts/sync-excel.mjs rồi chạy lại.\n');
  process.exit(0);
}

/* --- Dựng payload ------------------------------------------------- */

const rows = [];
const skipped = [];

for (let r = headerIndex + 1; r < grid.length && rows.length < LIMIT; r += 1) {
  const row = grid[r] ?? [];
  const rawCrId = toText(row[headerMap.cr_id]);
  if (!rawCrId) continue;

  const record = {};
  for (const [target, col] of Object.entries(headerMap)) {
    const raw = row[col];
    let value;
    if (NUMERIC_COLUMNS.has(target)) value = toProgress(raw, rawCrId);
    else if (DATE_COLUMNS.has(target)) value = toIsoDate(raw);
    else value = toText(raw);

    if (SKIP_EMPTY && (value === null || value === '')) continue;
    record[target] = value;
  }

  record.cr_id = rawCrId;
  if (!record.title) {
    skipped.push(`${rawCrId} (thiếu title — cột NOT NULL)`);
    continue;
  }
  rows.push(record);
}

console.log(`\nĐọc được ${rows.length} dòng có mã CR hợp lệ.`);
if (skipped.length) {
  console.log(`Bỏ qua ${skipped.length} dòng: ${skipped.join(', ')}`);
}
if (progressWarnings.length) {
  console.log(
    `\n⚠ ${progressWarnings.length} ô tiến độ có giá trị ≤ 1, đã hiểu là tỷ lệ phần trăm:`,
  );
  console.log('  ' + progressWarnings.slice(0, 10).join(', '));
}

if (rows.length === 0) fail('Không có dòng nào để đồng bộ.');

if (DRY_RUN) {
  console.log('\n--- DRY RUN: 2 bản ghi đầu sẽ gửi lên ---');
  console.log(JSON.stringify(rows.slice(0, 2), null, 2));
  console.log('\n✓ Không ghi gì vào DB.\n');
  process.exit(0);
}

/* --- Kết nối Supabase --------------------------------------------- */

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY;

if (!url) fail('Thiếu VITE_SUPABASE_URL (hoặc SUPABASE_URL) trong .env.local.');

let supabase;
if (serviceKey) {
  console.log('\nXác thực: service_role key (bỏ qua RLS).');
  supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
} else {
  if (!anonKey) fail('Thiếu cả SUPABASE_SERVICE_ROLE_KEY lẫn anon key.');
  const email = process.env.SYNC_EMAIL;
  const password = process.env.SYNC_PASSWORD;
  if (!email || !password) {
    fail(
      'RLS yêu cầu đăng nhập. Đặt SYNC_EMAIL và SYNC_PASSWORD trong .env.local, ' +
        'hoặc dùng SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail(`Đăng nhập thất bại: ${error.message}`);
  console.log(`\nXác thực: đăng nhập bằng ${email} (quyền authenticated).`);
}

/* --- Upsert từng dòng --------------------------------------------- */

let inserted = 0;
let updated = 0;
const failures = [];

for (const record of rows) {
  const { data: existing, error: lookupError } = await supabase
    .from('change_requests')
    .select('id')
    .eq('cr_id', record.cr_id)
    .maybeSingle();

  if (lookupError) {
    failures.push(`${record.cr_id}: ${lookupError.message}`);
    continue;
  }

  const { error } = existing
    ? await supabase.from('change_requests').update(record).eq('id', existing.id)
    : await supabase.from('change_requests').insert(record);

  if (error) {
    failures.push(`${record.cr_id}: ${error.message}`);
    continue;
  }

  if (existing) updated += 1;
  else inserted += 1;
  process.stdout.write(`\r  đã xử lý ${inserted + updated}/${rows.length}`);
}

process.stdout.write('\n');
console.log(`\n✓ Thêm mới: ${inserted}  |  Cập nhật: ${updated}`);
if (failures.length) {
  console.log(`\n✗ ${failures.length} dòng lỗi:`);
  failures.forEach((line) => console.log(`  ${line}`));
  process.exit(1);
}
console.log('');
