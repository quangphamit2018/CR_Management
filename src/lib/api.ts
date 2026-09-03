import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';

import { supabase, toError } from '@/lib/supabase';
import { removeCrFile } from '@/lib/storage';
import type { ChildTable } from '@/lib/child-schema';
import type {
  ChangeRequest,
  ChangeRequestInput,
  CrDocument,
  CrEmail,
  CrRelease,
  DashboardSummary,
  ListChangeRequestsParams,
  MetricBucket,
  TimelineEntry,
  TimelineEntryWithCr,
  UatTestCase,
} from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Query keys                                                          */
/* ------------------------------------------------------------------ */

export const qk = {
  health: ['health'] as const,
  dashboard: ['dashboard-summary'] as const,
  crList: (params?: ListChangeRequestsParams) =>
    ['change-requests', params ?? {}] as const,
  cr: (id: string) => ['change-request', id] as const,
  documents: (id: string) => ['documents', id] as const,
  emails: (id: string) => ['emails', id] as const,
  uat: (id: string) => ['uat-cases', id] as const,
  releases: (id: string) => ['releases', id] as const,
  timeline: (id: string) => ['timeline', id] as const,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Cột date/timestamp của Postgres không nhận chuỗi rỗng — phải đổi sang null. */
const DATE_COLUMNS = [
  'request_date',
  'target_date',
  'approval_date',
] as const;

const WRITABLE_COLUMNS: (keyof ChangeRequestInput)[] = [
  'cr_id',
  'title',
  'legacy_name',
  'folder_name',
  'application',
  'requester',
  'department',
  'request_date',
  'category',
  'priority',
  'summary',
  'status',
  'owner',
  'approval_date',
  'approval_status',
  'target_date',
  'mail_thread',
  'progress_text',
  'progress',
  'notes',
  'brd_ref',
  'fsd_ref',
  'quotation_ref',
  'uat_ref',
  'release_ref',
];

/**
 * Lọc payload xuống đúng các cột được phép ghi, đổi chuỗi rỗng ở cột ngày
 * thành null và ép `progress` về số trong khoảng 0–100.
 */
export function sanitizeChangeRequest(
  input: Partial<ChangeRequestInput>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const key of WRITABLE_COLUMNS) {
    if (!(key in input)) continue;
    let value = input[key] as unknown;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      value = trimmed === '' ? null : trimmed;
    }

    if ((DATE_COLUMNS as readonly string[]).includes(key) && value === '') {
      value = null;
    }

    if (key === 'progress') {
      const num = Number(value ?? 0);
      value = Number.isFinite(num) ? Math.min(100, Math.max(0, num)) : 0;
    }

    out[key] = value;
  }

  return out;
}

/** PostgREST dùng dấu phẩy để tách điều kiện trong `.or()` nên phải làm sạch. */
function escapeForOr(term: string): string {
  return term.replace(/[,()]/g, ' ').trim();
}

function tally(
  rows: ChangeRequest[],
  pick: (row: ChangeRequest) => string | null | undefined,
  fallback = 'Chưa phân loại',
): MetricBucket[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const raw = pick(row);
    const label = raw && String(raw).trim() !== '' ? String(raw).trim() : fallback;
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

async function unwrap<T>(
  promise: PromiseLike<{ data: T | null; error: unknown }>,
): Promise<T> {
  const { data, error } = await promise;
  if (error) throw toError(error);
  return (data ?? []) as T;
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

export interface HealthStatus {
  status: 'ok' | 'error';
  message?: string;
  rows?: number;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const { count, error } = await supabase
    .from('change_requests')
    .select('id', { count: 'exact', head: true });

  if (error) {
    return { status: 'error', message: toError(error).message };
  }
  return { status: 'ok', rows: count ?? 0 };
}

export function useHealthCheck() {
  return useQuery({
    queryKey: qk.health,
    queryFn: fetchHealth,
    staleTime: 30_000,
    retry: 1,
  });
}

/* ------------------------------------------------------------------ */
/* Danh sách CR                                                        */
/* ------------------------------------------------------------------ */

export async function fetchChangeRequests(
  params: ListChangeRequestsParams = {},
): Promise<ChangeRequest[]> {
  let query = supabase.from('change_requests').select('*');

  if (params.status) query = query.eq('status', params.status);
  if (params.priority) query = query.eq('priority', params.priority);
  if (params.application) query = query.eq('application', params.application);

  const search = params.search ? escapeForOr(params.search) : '';
  if (search) {
    const pattern = `%${search}%`;
    query = query.or(
      [
        `cr_id.ilike.${pattern}`,
        `title.ilike.${pattern}`,
        `application.ilike.${pattern}`,
        `owner.ilike.${pattern}`,
        `requester.ilike.${pattern}`,
        `legacy_name.ilike.${pattern}`,
      ].join(','),
    );
  }

  switch (params.sort) {
    case 'target_date':
      query = query.order('target_date', {
        ascending: true,
        nullsFirst: false,
      });
      break;
    case 'progress':
      query = query.order('progress', { ascending: false });
      break;
    case 'cr_id':
      query = query.order('cr_id', { ascending: true });
      break;
    default:
      query = query.order('updated_at', { ascending: false });
  }

  return unwrap<ChangeRequest[]>(query);
}

export function useListChangeRequests(params: ListChangeRequestsParams = {}) {
  return useQuery({
    queryKey: qk.crList(params),
    queryFn: () => fetchChangeRequests(params),
    placeholderData: (previous) => previous,
  });
}

/* ------------------------------------------------------------------ */
/* Chi tiết một CR                                                     */
/* ------------------------------------------------------------------ */

export async function fetchChangeRequest(id: string): Promise<ChangeRequest> {
  const { data, error } = await supabase
    .from('change_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw toError(error);
  if (!data) throw new Error(`Không tìm thấy change request với id ${id}`);
  return data as ChangeRequest;
}

export function useGetChangeRequest(
  id: string,
  options?: Partial<UseQueryOptions<ChangeRequest, Error>>,
) {
  return useQuery<ChangeRequest, Error>({
    queryKey: qk.cr(id),
    queryFn: () => fetchChangeRequest(id),
    enabled: Boolean(id),
    ...options,
  });
}

/* ------------------------------------------------------------------ */
/* Ghi timeline                                                        */
/* ------------------------------------------------------------------ */

async function logTimeline(crId: string, activity: string): Promise<void> {
  // Không để lỗi ghi nhật ký làm hỏng thao tác chính của người dùng.
  const { error } = await supabase
    .from('cr_timeline')
    .insert({ cr_id: crId, activity });
  if (error) {
    console.warn('Không ghi được timeline:', toError(error).message);
  }
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export function useCreateChangeRequest() {
  const client = useQueryClient();
  return useMutation<ChangeRequest, Error, ChangeRequestInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase
        .from('change_requests')
        .insert(sanitizeChangeRequest(input))
        .select()
        .single();
      if (error) throw toError(error);
      const created = data as ChangeRequest;
      await logTimeline(created.id, `Tạo change request ${created.cr_id}`);
      return created;
    },
    onSuccess: (created) => {
      client.invalidateQueries({ queryKey: ['change-requests'] });
      client.invalidateQueries({ queryKey: qk.dashboard });
      client.setQueryData(qk.cr(created.id), created);
    },
  });
}

export function useUpdateChangeRequest() {
  const client = useQueryClient();
  return useMutation<
    ChangeRequest,
    Error,
    { id: string; data: Partial<ChangeRequestInput> }
  >({
    mutationFn: async ({ id, data: payload }) => {
      const { data, error } = await supabase
        .from('change_requests')
        .update(sanitizeChangeRequest(payload))
        .eq('id', id)
        .select()
        .single();
      if (error) throw toError(error);
      const updated = data as ChangeRequest;
      await logTimeline(
        updated.id,
        `Cập nhật ${updated.cr_id} — trạng thái ${updated.status}, tiến độ ${updated.progress}%`,
      );
      return updated;
    },
    onSuccess: (updated) => {
      client.setQueryData(qk.cr(updated.id), updated);
      client.invalidateQueries({ queryKey: ['change-requests'] });
      client.invalidateQueries({ queryKey: qk.dashboard });
      client.invalidateQueries({ queryKey: qk.timeline(updated.id) });
    },
  });
}

export function useDeleteChangeRequest() {
  const client = useQueryClient();
  return useMutation<string, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const { error } = await supabase
        .from('change_requests')
        .delete()
        .eq('id', id);
      if (error) throw toError(error);
      return id;
    },
    onSuccess: (id) => {
      client.removeQueries({ queryKey: qk.cr(id) });
      client.invalidateQueries({ queryKey: ['change-requests'] });
      client.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Bảng con                                                            */
/* ------------------------------------------------------------------ */

export function useListDocuments(crId: string) {
  return useQuery<CrDocument[], Error>({
    queryKey: qk.documents(crId),
    enabled: Boolean(crId),
    queryFn: () =>
      unwrap<CrDocument[]>(
        supabase
          .from('documents')
          .select('*')
          .eq('cr_id', crId)
          .order('created_at', { ascending: false }),
      ),
  });
}

export function useListEmails(crId: string) {
  return useQuery<CrEmail[], Error>({
    queryKey: qk.emails(crId),
    enabled: Boolean(crId),
    queryFn: () =>
      unwrap<CrEmail[]>(
        supabase
          .from('emails')
          .select('*')
          .eq('cr_id', crId)
          .order('received_at', { ascending: false, nullsFirst: false }),
      ),
  });
}

export function useListUatCases(crId: string) {
  return useQuery<UatTestCase[], Error>({
    queryKey: qk.uat(crId),
    enabled: Boolean(crId),
    queryFn: () =>
      unwrap<UatTestCase[]>(
        supabase
          .from('uat_test_cases')
          .select('*')
          .eq('cr_id', crId)
          .order('created_at', { ascending: true }),
      ),
  });
}

export function useListReleases(crId: string) {
  return useQuery<CrRelease[], Error>({
    queryKey: qk.releases(crId),
    enabled: Boolean(crId),
    queryFn: () =>
      unwrap<CrRelease[]>(
        supabase
          .from('releases')
          .select('*')
          .eq('cr_id', crId)
          .order('planned_date', { ascending: false, nullsFirst: false }),
      ),
  });
}

export function useListTimeline(crId: string) {
  return useQuery<TimelineEntry[], Error>({
    queryKey: qk.timeline(crId),
    enabled: Boolean(crId),
    queryFn: () =>
      unwrap<TimelineEntry[]>(
        supabase
          .from('cr_timeline')
          .select('*')
          .eq('cr_id', crId)
          .order('occurred_at', { ascending: false }),
      ),
  });
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const rows = await unwrap<ChangeRequest[]>(
    supabase
      .from('change_requests')
      .select('*')
      .order('updated_at', { ascending: false }),
  );

  const total = rows.length;
  const averageProgress =
    total === 0
      ? 0
      : rows.reduce((sum, row) => sum + Number(row.progress ?? 0), 0) / total;

  const criticalHigh = rows.filter((row) =>
    ['critical', 'high'].includes(String(row.priority ?? '').toLowerCase()),
  ).length;

  const released = rows.filter(
    (row) => String(row.status ?? '').toLowerCase() === 'released',
  ).length;

  // Timeline thật; nếu bảng còn trống thì suy ra từ các CR vừa cập nhật.
  let activity: TimelineEntryWithCr[] = [];
  const { data: timelineRows, error: timelineError } = await supabase
    .from('cr_timeline')
    .select('id, cr_id, activity, occurred_at, created_at')
    .order('occurred_at', { ascending: false })
    .limit(8);

  if (!timelineError && timelineRows && timelineRows.length > 0) {
    const codeById = new Map(rows.map((row) => [row.id, row.cr_id]));
    activity = (timelineRows as TimelineEntry[]).map((entry) => ({
      ...entry,
      cr_code: codeById.get(entry.cr_id) ?? null,
    }));
  } else {
    activity = rows.slice(0, 8).map((row) => ({
      id: `derived-${row.id}`,
      cr_id: row.id,
      cr_code: row.cr_id,
      activity: `${row.cr_id} — ${row.status} (${Math.round(Number(row.progress ?? 0))}%)`,
      occurred_at: row.updated_at,
      created_at: row.updated_at,
    }));
  }

  return {
    total,
    average_progress: averageProgress,
    critical_high: criticalHigh,
    released,
    by_status: tally(rows, (row) => row.status, 'Chưa có trạng thái'),
    by_application: tally(rows, (row) => row.application, 'Chưa gán ứng dụng'),
    by_owner: tally(rows, (row) => row.owner, 'Chưa gán người phụ trách'),
    by_category: tally(rows, (row) => row.category),
    by_priority: tally(rows, (row) => row.priority, 'Chưa đặt mức ưu tiên'),
    recent_activity: activity,
  };
}

export function useGetDashboardSummary() {
  return useQuery<DashboardSummary, Error>({
    queryKey: qk.dashboard,
    queryFn: fetchDashboardSummary,
  });
}

/* ------------------------------------------------------------------ */
/* CRUD cho bảng con                                                   */
/* ------------------------------------------------------------------ */

const CHILD_QUERY_KEY: Record<ChildTable, (crId: string) => readonly unknown[]> = {
  documents: qk.documents,
  emails: qk.emails,
  uat_test_cases: qk.uat,
  releases: qk.releases,
  cr_timeline: qk.timeline,
};

export interface SaveChildInput {
  /** Có id là cập nhật, không có id là thêm mới. */
  id?: string;
  values: Record<string, unknown>;
}

export function useSaveChildRecord(table: ChildTable, crId: string) {
  const client = useQueryClient();
  return useMutation<Record<string, unknown>, Error, SaveChildInput>({
    mutationFn: async ({ id, values }) => {
      const payload = { ...values, cr_id: crId };

      const request = id
        ? supabase.from(table).update(values).eq('id', id).select().single()
        : supabase.from(table).insert(payload).select().single();

      const { data, error } = await request;
      if (error) throw toError(error);
      return data as Record<string, unknown>;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: CHILD_QUERY_KEY[table](crId) });
      if (table !== 'cr_timeline') {
        client.invalidateQueries({ queryKey: qk.timeline(crId) });
      }
      client.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useDeleteChildRecord(table: ChildTable, crId: string) {
  const client = useQueryClient();
  return useMutation<string, Error, { id: string; storagePath?: string | null }>({
    mutationFn: async ({ id, storagePath }) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw toError(error);
      if (storagePath) await removeCrFile(storagePath);
      return id;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: CHILD_QUERY_KEY[table](crId) });
      client.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/** Ghi một dòng timeline thủ công (dùng cho nút "Ghi hoạt động"). */
export function useAddTimelineEntry(crId: string) {
  const client = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (activity) => {
      const { error } = await supabase
        .from('cr_timeline')
        .insert({ cr_id: crId, activity });
      if (error) throw toError(error);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.timeline(crId) });
      client.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}
