/**
 * Các kiểu dữ liệu này bám sát đúng schema trong
 * `supabase/01_schema_and_seed.sql`. Đổi cột trong SQL thì phải đổi ở đây.
 */

export interface ChangeRequest {
  id: string;
  cr_id: string;
  title: string;
  legacy_name: string | null;
  folder_name: string | null;
  application: string | null;
  requester: string | null;
  department: string | null;
  request_date: string | null;
  category: string;
  priority: string;
  summary: string | null;
  status: string;
  owner: string | null;
  approval_date: string | null;
  approval_status: string | null;
  target_date: string | null;
  mail_thread: string | null;
  progress_text: string | null;
  progress: number;
  notes: string | null;
  brd_ref: string | null;
  fsd_ref: string | null;
  quotation_ref: string | null;
  uat_ref: string | null;
  release_ref: string | null;
  created_at: string;
  updated_at: string;
}

/** Payload ghi vào bảng change_requests (không gồm cột do DB tự sinh). */
export type ChangeRequestInput = Partial<
  Omit<ChangeRequest, 'id' | 'created_at' | 'updated_at'>
> & {
  cr_id: string;
  title: string;
};

export interface CrDocument {
  id: string;
  cr_id: string;
  doc_type: 'BRD' | 'FSD' | 'QUOTATION' | 'OTHER' | string;
  title: string;
  version: string | null;
  status: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrEmail {
  id: string;
  cr_id: string;
  subject: string | null;
  sender: string | null;
  recipients: string | null;
  cc: string | null;
  received_at: string | null;
  body: string | null;
  message_id: string | null;
  attachment_count: number;
  created_at: string;
}

export interface UatTestCase {
  id: string;
  cr_id: string;
  test_case_id: string | null;
  module: string | null;
  scenario: string;
  steps: string | null;
  test_data: string | null;
  expected_result: string | null;
  actual_result: string | null;
  status: 'Not Started' | 'Pass' | 'Fail' | 'Blocked' | string;
  tester: string | null;
  test_date: string | null;
  business_signoff: string | null;
  signoff_date: string | null;
  defect_note: string | null;
  created_at: string;
}

export interface CrRelease {
  id: string;
  cr_id: string;
  release_id: string | null;
  name: string;
  planned_date: string | null;
  actual_date: string | null;
  features: string | null;
  environment: string | null;
  deploy_plan: string | null;
  rollback_plan: string | null;
  owner: string | null;
  go_live_checklist: boolean;
  signoff_by: string | null;
  signoff_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface TimelineEntry {
  id: string;
  cr_id: string;
  activity: string;
  occurred_at: string;
  created_at: string;
}

/** Bản ghi timeline có kèm mã CR để hiển thị ở dashboard. */
export interface TimelineEntryWithCr extends TimelineEntry {
  cr_code: string | null;
}

export interface MetricBucket {
  label: string;
  value: number;
}

export interface DashboardSummary {
  total: number;
  average_progress: number;
  critical_high: number;
  released: number;
  by_status: MetricBucket[];
  by_application: MetricBucket[];
  by_owner: MetricBucket[];
  by_category: MetricBucket[];
  by_priority: MetricBucket[];
  recent_activity: TimelineEntryWithCr[];
}

export interface ListChangeRequestsParams {
  search?: string;
  status?: string;
  priority?: string;
  application?: string;
  sort?: 'updated_at' | 'target_date' | 'progress' | 'cr_id';
}

export const STATUS_OPTIONS = [
  'New',
  'In Review',
  'In Progress',
  'On Hold',
  'UAT',
  'Approved',
  'Released',
  'Blocked',
  'Cancelled',
] as const;

export const PRIORITY_OPTIONS = [
  'Critical',
  'High',
  'Medium',
  'Normal',
  'Low',
] as const;

export const CATEGORY_OPTIONS = [
  'Enhancement',
  'New Feature',
  'Bug Fix',
  'Configuration',
  'Report',
  'Other',
] as const;

export const APPROVAL_OPTIONS = [
  'Pending',
  'Approved',
  'Rejected',
  'Not Required',
] as const;
