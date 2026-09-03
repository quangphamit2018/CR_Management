/**
 * Khai báo field cho từng bảng con. Dialog thêm/sửa được sinh ra từ đây,
 * nên muốn thêm cột thì chỉ cần khai báo ở file này (và cột phải tồn tại
 * thật trong Postgres, xem `supabase/01_schema_and_seed.sql`).
 */

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'checkbox';

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
  required?: boolean;
  placeholder?: string;
  /** 1 = nửa hàng, 2 = cả hàng. Mặc định 1. */
  span?: 1 | 2;
}

export type ChildTable =
  | 'documents'
  | 'emails'
  | 'uat_test_cases'
  | 'releases'
  | 'cr_timeline';

export interface ChildSchema {
  table: ChildTable;
  singular: string;
  fields: FieldDef[];
  /** Cột dùng làm nhãn ngắn khi hỏi xác nhận xoá. */
  labelField: string;
  /** Bảng này có đính kèm file vào Storage hay không. */
  hasFile?: boolean;
}

export const DOC_TYPES = ['BRD', 'FSD', 'QUOTATION', 'OTHER'] as const;
export const DOC_STATUSES = ['Draft', 'In Review', 'Approved', 'Obsolete'] as const;
export const UAT_STATUSES = ['Not Started', 'Pass', 'Fail', 'Blocked'] as const;
export const RELEASE_STATUSES = [
  'Planned',
  'Ready',
  'Deployed',
  'Rolled Back',
  'Closed',
] as const;
export const ENVIRONMENTS = ['DEV', 'QA', 'UAT', 'PROD'] as const;

export const DOCUMENT_SCHEMA: ChildSchema = {
  table: 'documents',
  singular: 'hồ sơ',
  labelField: 'title',
  hasFile: true,
  fields: [
    { name: 'doc_type', label: 'Loại hồ sơ', kind: 'select', options: DOC_TYPES, required: true },
    { name: 'status', label: 'Trạng thái', kind: 'select', options: DOC_STATUSES },
    { name: 'title', label: 'Tiêu đề', kind: 'text', required: true, span: 2, placeholder: 'VD: CR_001 — Business Requirement Document' },
    { name: 'version', label: 'Phiên bản', kind: 'text', placeholder: '1.0' },
    { name: 'notes', label: 'Ghi chú', kind: 'textarea', span: 2 },
  ],
};

export const EMAIL_SCHEMA: ChildSchema = {
  table: 'emails',
  singular: 'email',
  labelField: 'subject',
  fields: [
    { name: 'subject', label: 'Tiêu đề mail', kind: 'text', required: true, span: 2 },
    { name: 'sender', label: 'Người gửi', kind: 'text' },
    { name: 'received_at', label: 'Thời điểm nhận', kind: 'datetime' },
    { name: 'recipients', label: 'Người nhận (To)', kind: 'text' },
    { name: 'cc', label: 'CC', kind: 'text' },
    { name: 'message_id', label: 'Message-ID', kind: 'text' },
    { name: 'attachment_count', label: 'Số tệp đính kèm', kind: 'number' },
    { name: 'body', label: 'Nội dung', kind: 'textarea', span: 2 },
  ],
};

export const UAT_SCHEMA: ChildSchema = {
  table: 'uat_test_cases',
  singular: 'test case',
  labelField: 'scenario',
  fields: [
    { name: 'test_case_id', label: 'Mã test case', kind: 'text', placeholder: 'CR_001-TC-001' },
    { name: 'module', label: 'Module', kind: 'text' },
    { name: 'scenario', label: 'Kịch bản', kind: 'text', required: true, span: 2 },
    { name: 'status', label: 'Kết quả', kind: 'select', options: UAT_STATUSES, required: true },
    { name: 'tester', label: 'Người test', kind: 'text' },
    { name: 'test_date', label: 'Ngày test', kind: 'date' },
    { name: 'business_signoff', label: 'Business ký nhận', kind: 'text' },
    { name: 'signoff_date', label: 'Ngày ký nhận', kind: 'date' },
    { name: 'steps', label: 'Các bước', kind: 'textarea', span: 2 },
    { name: 'test_data', label: 'Dữ liệu test', kind: 'textarea', span: 2 },
    { name: 'expected_result', label: 'Kết quả mong đợi', kind: 'textarea', span: 2 },
    { name: 'actual_result', label: 'Kết quả thực tế', kind: 'textarea', span: 2 },
    { name: 'defect_note', label: 'Ghi nhận lỗi', kind: 'textarea', span: 2 },
  ],
};

export const RELEASE_SCHEMA: ChildSchema = {
  table: 'releases',
  singular: 'release',
  labelField: 'name',
  fields: [
    { name: 'release_id', label: 'Mã release', kind: 'text', placeholder: 'REL-2026-08' },
    { name: 'name', label: 'Tên release', kind: 'text', required: true },
    { name: 'status', label: 'Trạng thái', kind: 'select', options: RELEASE_STATUSES, required: true },
    { name: 'environment', label: 'Môi trường', kind: 'select', options: ENVIRONMENTS },
    { name: 'planned_date', label: 'Ngày dự kiến', kind: 'date' },
    { name: 'actual_date', label: 'Ngày thực tế', kind: 'date' },
    { name: 'owner', label: 'Phụ trách', kind: 'text' },
    { name: 'signoff_by', label: 'Người ký nhận', kind: 'text' },
    { name: 'signoff_date', label: 'Ngày ký nhận', kind: 'date' },
    { name: 'go_live_checklist', label: 'Đã xong checklist go-live', kind: 'checkbox' },
    { name: 'features', label: 'Nội dung release', kind: 'textarea', span: 2 },
    { name: 'deploy_plan', label: 'Kế hoạch triển khai', kind: 'textarea', span: 2 },
    { name: 'rollback_plan', label: 'Kế hoạch rollback', kind: 'textarea', span: 2 },
    { name: 'notes', label: 'Ghi chú', kind: 'textarea', span: 2 },
  ],
};

export const TIMELINE_SCHEMA: ChildSchema = {
  table: 'cr_timeline',
  singular: 'hoạt động',
  labelField: 'activity',
  fields: [
    { name: 'activity', label: 'Hoạt động', kind: 'text', required: true, span: 2 },
    { name: 'occurred_at', label: 'Thời điểm', kind: 'datetime', span: 2 },
  ],
};

/** Giá trị khởi tạo cho một bản ghi mới theo schema. */
export function emptyValues(schema: ChildSchema): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of schema.fields) {
    switch (field.kind) {
      case 'checkbox':
        values[field.name] = false;
        break;
      case 'number':
        values[field.name] = 0;
        break;
      case 'select':
        values[field.name] = field.options?.[0] ?? '';
        break;
      case 'datetime':
        values[field.name] = toDatetimeLocal(new Date().toISOString());
        break;
      default:
        values[field.name] = '';
    }
  }
  return values;
}

/** ISO timestamptz -> chuỗi cho <input type="datetime-local"> theo giờ máy. */
export function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Đưa bản ghi từ DB về dạng giá trị của form. */
export function toFormValues(
  schema: ChildSchema,
  record: Record<string, unknown>,
): Record<string, unknown> {
  const values = emptyValues(schema);
  for (const field of schema.fields) {
    const raw = record[field.name];
    if (raw === null || raw === undefined) {
      if (field.kind === 'checkbox') values[field.name] = false;
      else if (field.kind === 'number') values[field.name] = 0;
      else values[field.name] = '';
      continue;
    }
    if (field.kind === 'datetime') {
      values[field.name] = toDatetimeLocal(String(raw));
    } else if (field.kind === 'checkbox') {
      values[field.name] = Boolean(raw);
    } else if (field.kind === 'number') {
      values[field.name] = Number(raw);
    } else {
      values[field.name] = String(raw);
    }
  }
  return values;
}

/**
 * Chuyển giá trị form thành payload gửi PostgREST:
 * chuỗi rỗng -> null, datetime-local -> ISO, number -> số.
 */
export function toPayload(
  schema: ChildSchema,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of schema.fields) {
    const raw = values[field.name];

    if (field.kind === 'checkbox') {
      payload[field.name] = Boolean(raw);
      continue;
    }

    if (field.kind === 'number') {
      const num = Number(raw ?? 0);
      payload[field.name] = Number.isFinite(num) ? num : 0;
      continue;
    }

    const text = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw);
    if (text === '') {
      payload[field.name] = null;
      continue;
    }

    if (field.kind === 'datetime') {
      const date = new Date(text);
      payload[field.name] = Number.isNaN(date.getTime()) ? null : date.toISOString();
      continue;
    }

    payload[field.name] = text;
  }
  return payload;
}

/** Kiểm tra field bắt buộc; trả về thông báo lỗi hoặc null. */
export function validate(
  schema: ChildSchema,
  values: Record<string, unknown>,
): string | null {
  for (const field of schema.fields) {
    if (!field.required) continue;
    const raw = values[field.name];
    if (raw === null || raw === undefined || String(raw).trim() === '') {
      return `Trường "${field.label}" là bắt buộc.`;
    }
  }
  return null;
}
