import { type ReactNode, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Download,
  FileText,
  Mail,
  Pencil,
  Plus,
  Rocket,
  ShieldCheck,
  TestTube2,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Link, useParams } from 'wouter';

import {
  useDeleteChildRecord,
  useGetChangeRequest,
  useListDocuments,
  useListEmails,
  useListReleases,
  useListTimeline,
  useListUatCases,
  useUpdateChangeRequest,
} from '@/lib/api';
import type {
  ChangeRequest,
  ChangeRequestInput,
  CrDocument,
  CrEmail,
  CrRelease,
  TimelineEntry,
  UatTestCase,
} from '@/lib/types';
import {
  DOCUMENT_SCHEMA,
  EMAIL_SCHEMA,
  RELEASE_SCHEMA,
  TIMELINE_SCHEMA,
  UAT_SCHEMA,
  type ChildSchema,
} from '@/lib/child-schema';
import { formatBytes, openCrFile } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { ChangeRequestForm } from '@/components/change-request-form';
import { ChildRecordDialog } from '@/components/child-record-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeading,
  PriorityBadge,
  SectionTitle,
  StatusBadge,
} from '@/components/cr-ui';

type Tab = 'overview' | 'documents' | 'mail' | 'uat' | 'releases' | 'timeline';

const TAB_SCHEMA: Partial<Record<Tab, ChildSchema>> = {
  documents: DOCUMENT_SCHEMA,
  mail: EMAIL_SCHEMA,
  uat: UAT_SCHEMA,
  releases: RELEASE_SCHEMA,
  timeline: TIMELINE_SCHEMA,
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

export default function ChangeRequestDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<{
    schema: ChildSchema;
    record: Record<string, unknown> | null;
  } | null>(null);

  const detail = useGetChangeRequest(id);
  const documents = useListDocuments(id);
  const emails = useListEmails(id);
  const uat = useListUatCases(id);
  const releases = useListReleases(id);
  const timeline = useListTimeline(id);
  const update = useUpdateChangeRequest();

  const activeSchema = TAB_SCHEMA[tab];
  const removeChild = useDeleteChildRecord(
    activeSchema?.table ?? 'cr_timeline',
    id,
  );

  if (detail.isLoading) return <LoadingBlock rows={8} />;
  if (detail.isError || !detail.data) {
    return (
      <ErrorState onRetry={() => void detail.refetch()} message={detail.error?.message} />
    );
  }

  const cr = detail.data;

  const tabs: { key: Tab; label: string; icon: typeof FileText; count?: number }[] = [
    { key: 'overview', label: 'Tổng quan', icon: ShieldCheck },
    { key: 'documents', label: 'Hồ sơ', icon: FileText, count: documents.data?.length },
    { key: 'mail', label: 'Mail', icon: Mail, count: emails.data?.length },
    { key: 'uat', label: 'UAT', icon: TestTube2, count: uat.data?.length },
    { key: 'releases', label: 'Release', icon: Rocket, count: releases.data?.length },
    { key: 'timeline', label: 'Timeline', icon: CalendarDays, count: timeline.data?.length },
  ];

  const save = (value: ChangeRequestInput) =>
    update.mutate(
      { id, data: value },
      {
        onSuccess: () => {
          toast({ title: 'Đã lưu', description: `${cr.cr_id} đã được cập nhật.` });
          setEditing(false);
        },
        onError: (error) =>
          toast({ title: 'Lưu thất bại', description: error.message, variant: 'destructive' }),
      },
    );

  const deleteChild = (
    schema: ChildSchema,
    record: Record<string, unknown>,
  ) => {
    const label = String(record[schema.labelField] ?? 'bản ghi này');
    if (!window.confirm(`Xoá ${schema.singular} "${label}"? Không thể hoàn tác.`)) return;
    removeChild.mutate(
      {
        id: String(record.id),
        storagePath: (record.storage_path as string | null) ?? null,
      },
      {
        onSuccess: () => toast({ title: 'Đã xoá', description: label }),
        onError: (error) =>
          toast({ title: 'Xoá thất bại', description: error.message, variant: 'destructive' }),
      },
    );
  };

  const download = async (path: string) => {
    try {
      await openCrFile(path);
    } catch (cause) {
      toast({
        title: 'Không mở được tệp',
        description: cause instanceof Error ? cause.message : String(cause),
        variant: 'destructive',
      });
    }
  };

  return (
    <div data-testid={`page-change-request-detail-${id}`}>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/change-requests"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
          data-testid="link-back-register"
        >
          <ArrowLeft className="size-4" /> Sổ đăng ký
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-[11px] text-muted-foreground">{cr.cr_id}</span>
      </div>

      {!editing ? (
        <PageHeading
          eyebrow={`Request / ${cr.cr_id}`}
          title={cr.title}
          description={cr.summary || 'Chưa có tóm tắt nghiệp vụ cho hồ sơ này.'}
          action={
            <Button
              variant="outline"
              onClick={() => setEditing(true)}
              data-testid="button-edit-change-request"
            >
              <Pencil className="mr-2 size-4" /> Sửa hồ sơ
            </Button>
          }
        />
      ) : (
        <>
          <PageHeading eyebrow={`Request / ${cr.cr_id}`} title="Sửa change request" />
          <div className="rounded-xl border border-card-border bg-card p-5 shadow-xs md:p-8">
            <ChangeRequestForm
              initial={cr}
              pending={update.isPending}
              error={update.error?.message ?? null}
              onSubmit={save}
              onCancel={() => setEditing(false)}
            />
          </div>
        </>
      )}

      {!editing && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryTile label="Vòng đời">
              <StatusBadge status={cr.status} />
            </SummaryTile>
            <SummaryTile label="Ưu tiên">
              <PriorityBadge priority={cr.priority} />
            </SummaryTile>
            <SummaryTile label="Phụ trách">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <UserRound className="size-3.5 text-muted-foreground" />
                {cr.owner || 'Chưa gán'}
              </div>
            </SummaryTile>
            <SummaryTile label="Ngày mục tiêu">
              <div className="text-xs font-bold">{formatDate(cr.target_date)}</div>
            </SummaryTile>
            <SummaryTile label="Tiến độ">
              <div className="flex items-center gap-2 text-xs font-bold">
                <div className="h-1.5 flex-1 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Number(cr.progress ?? 0))}%` }}
                  />
                </div>
                {Math.round(Number(cr.progress ?? 0))}%
              </div>
            </SummaryTile>
          </div>

          <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
            {tabs.map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-extrabold ${
                  tab === key
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                data-testid={`tab-${key}`}
              >
                <Icon className="size-4" />
                {label}
                {count !== undefined && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === 'overview' && <Overview cr={cr} />}

          {tab === 'documents' && (
            <DataList
              schema={DOCUMENT_SCHEMA}
              title="Hồ sơ & bằng chứng"
              items={documents.data}
              loading={documents.isLoading}
              error={documents.error?.message}
              empty="Chưa liên kết hồ sơ nào"
              onAdd={() => setDialog({ schema: DOCUMENT_SCHEMA, record: null })}
              onEdit={(item) => setDialog({ schema: DOCUMENT_SCHEMA, record: item })}
              onDelete={(item) => deleteChild(DOCUMENT_SCHEMA, item)}
              render={(item) => (
                <>
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary">
                      <FileText className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{item.title}</p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {item.doc_type}
                        {item.version ? ` · v${item.version}` : ''}
                        {item.file_name ? ` · ${item.file_name}` : ' · chưa có tệp'}
                        {item.file_size ? ` · ${formatBytes(item.file_size)}` : ''}
                      </p>
                    </div>
                    <div className="ml-auto shrink-0">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {item.notes || `Ghi nhận ngày ${formatDate(item.created_at)}`}
                  </p>
                  {item.storage_path && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => void download(item.storage_path as string)}
                      data-testid={`button-download-${item.id}`}
                    >
                      <Download className="mr-2 size-3.5" /> Tải tệp (link 5 phút)
                    </Button>
                  )}
                </>
              )}
            />
          )}

          {tab === 'mail' && (
            <DataList
              schema={EMAIL_SCHEMA}
              title="Luồng mail"
              items={emails.data}
              loading={emails.isLoading}
              error={emails.error?.message}
              empty="Chưa liên kết mail nào"
              onAdd={() => setDialog({ schema: EMAIL_SCHEMA, record: null })}
              onEdit={(item) => setDialog({ schema: EMAIL_SCHEMA, record: item })}
              onDelete={(item) => deleteChild(EMAIL_SCHEMA, item)}
              render={(item) => (
                <>
                  <p className="pr-16 text-sm font-bold">{item.subject || '(Không tiêu đề)'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.sender || 'Không rõ người gửi'} · {formatDateTime(item.received_at)}
                  </p>
                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                    {item.body || 'Không có nội dung.'}
                  </p>
                  {Boolean(item.attachment_count) && (
                    <span className="mt-3 inline-flex rounded bg-secondary px-2 py-1 font-mono text-[10px]">
                      {item.attachment_count} tệp đính kèm
                    </span>
                  )}
                </>
              )}
            />
          )}

          {tab === 'uat' && (
            <DataList
              schema={UAT_SCHEMA}
              title="Ma trận UAT"
              items={uat.data}
              loading={uat.isLoading}
              error={uat.error?.message}
              empty="Chưa có test case nào"
              onAdd={() => setDialog({ schema: UAT_SCHEMA, record: null })}
              onEdit={(item) => setDialog({ schema: UAT_SCHEMA, record: item })}
              onDelete={(item) => deleteChild(UAT_SCHEMA, item)}
              render={(item) => (
                <>
                  <div className="flex items-start gap-3 pr-16">
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {item.test_case_id || '—'}
                      </span>
                      <p className="mt-1 text-sm font-bold">{item.scenario}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.module || '—'} · Tester: {item.tester || 'Chưa gán'} ·{' '}
                        {formatDate(item.test_date)}
                      </p>
                    </div>
                    <div className="ml-auto shrink-0">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  {item.expected_result && (
                    <p className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">
                      <span className="font-bold">Mong đợi: </span>
                      {item.expected_result}
                    </p>
                  )}
                  {item.defect_note && (
                    <p className="mt-2 rounded-md bg-destructive/5 p-2 text-xs text-destructive">
                      {item.defect_note}
                    </p>
                  )}
                </>
              )}
            />
          )}

          {tab === 'releases' && (
            <DataList
              schema={RELEASE_SCHEMA}
              title="Mức sẵn sàng release"
              items={releases.data}
              loading={releases.isLoading}
              error={releases.error?.message}
              empty="Chưa có release nào"
              onAdd={() => setDialog({ schema: RELEASE_SCHEMA, record: null })}
              onEdit={(item) => setDialog({ schema: RELEASE_SCHEMA, record: item })}
              onDelete={(item) => deleteChild(RELEASE_SCHEMA, item)}
              render={(item) => (
                <>
                  <div className="flex items-start gap-3 pr-16">
                    <div className="min-w-0">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {item.release_id || '—'} · {item.environment || '—'}
                      </span>
                      <p className="mt-1 text-sm font-bold">{item.name}</p>
                    </div>
                    <div className="ml-auto shrink-0">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <span>Dự kiến: {formatDate(item.planned_date)}</span>
                    <span>Thực tế: {formatDate(item.actual_date)}</span>
                    <span>Phụ trách: {item.owner || '—'}</span>
                    <span>Ký nhận: {item.signoff_by || 'Chưa'}</span>
                    <span>Ngày ký: {formatDate(item.signoff_date)}</span>
                    <span>Checklist: {item.go_live_checklist ? 'Đã xong' : 'Chưa'}</span>
                  </div>
                </>
              )}
            />
          )}

          {tab === 'timeline' && (
            <DataList
              schema={TIMELINE_SCHEMA}
              title="Dòng thời gian"
              items={timeline.data}
              loading={timeline.isLoading}
              error={timeline.error?.message}
              empty="Chưa có hoạt động nào"
              onAdd={() => setDialog({ schema: TIMELINE_SCHEMA, record: null })}
              onEdit={(item) => setDialog({ schema: TIMELINE_SCHEMA, record: item })}
              onDelete={(item) => deleteChild(TIMELINE_SCHEMA, item)}
              render={(item) => (
                <div className="flex gap-4 pr-16">
                  <span className="relative mt-1 block size-2.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/15" />
                  <div>
                    <p className="text-sm font-bold">{item.activity}</p>
                    <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                      {formatDateTime(item.occurred_at)}
                    </span>
                  </div>
                </div>
              )}
            />
          )}
        </>
      )}

      {dialog && (
        <ChildRecordDialog
          schema={dialog.schema}
          crId={id}
          record={dialog.record}
          onClose={() => setDialog(null)}
          onSaved={() =>
            toast({
              title: 'Đã lưu',
              description: `Cập nhật ${dialog.schema.singular} thành công.`,
            })
          }
        />
      )}
    </div>
  );
}

function SummaryTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <span className="kicker text-muted-foreground">{label}</span>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Overview({ cr }: { cr: ChangeRequest }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
      <section className="rounded-xl border border-card-border bg-card p-5 shadow-xs md:p-6">
        <SectionTitle>Ghi chú vận hành</SectionTitle>
        <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
          {cr.notes ||
            'Chưa có ghi chú. Bổ sung phụ thuộc, rủi ro và next action khi sửa hồ sơ.'}
        </p>

        {cr.progress_text && (
          <>
            <div className="kicker mt-7 text-muted-foreground">Diễn giải tiến độ</div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
              {cr.progress_text}
            </p>
          </>
        )}

        {cr.mail_thread && (
          <>
            <div className="kicker mt-7 text-muted-foreground">Mail thread</div>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
              {cr.mail_thread}
            </p>
          </>
        )}

        <div className="mt-7 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <Info label="Người yêu cầu" value={cr.requester} />
          <Info label="Phòng ban" value={cr.department} />
          <Info label="Phân loại" value={cr.category} />
          <Info label="Phê duyệt" value={cr.approval_status || 'Pending'} />
          <Info label="Ngày yêu cầu" value={formatDate(cr.request_date)} />
          <Info label="Ứng dụng" value={cr.application} />
          <Info label="Tên cũ" value={cr.legacy_name} />
          <Info label="Thư mục" value={cr.folder_name} />
          <Info label="BRD" value={cr.brd_ref} />
          <Info label="FSD" value={cr.fsd_ref} />
        </div>
      </section>

      <section className="grid-lines rounded-xl border border-card-border bg-secondary/35 p-5 md:p-6">
        <SectionTitle>Các mốc tiếp theo</SectionTitle>
        <div className="space-y-3">
          <ActionLine done={Number(cr.progress) >= 25} label="Đã ghi nhận và phân loại" />
          <ActionLine
            done={cr.approval_status === 'Approved' || Number(cr.progress) >= 50}
            label="Đã có bằng chứng phê duyệt"
          />
          <ActionLine done={Number(cr.progress) >= 75} label="UAT đạt và đã ký nhận" />
          <ActionLine done={cr.status === 'Released'} label="Sẵn sàng release" />
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="kicker text-muted-foreground">{label}</div>
      <div className="mt-1 text-xs font-bold">{value || '—'}</div>
    </div>
  );
}

function ActionLine({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/75 px-3 py-3 text-xs font-bold">
      <span
        className={`grid size-5 place-items-center rounded-full border ${
          done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border text-transparent'
        }`}
      >
        <Check className="size-3" />
      </span>
      {label}
      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
        {done ? 'DONE' : 'NEXT'}
      </span>
    </div>
  );
}

type ChildRow = CrDocument | CrEmail | UatTestCase | CrRelease | TimelineEntry;

function DataList<T extends ChildRow>({
  schema,
  title,
  items,
  loading,
  error,
  empty,
  render,
  onAdd,
  onEdit,
  onDelete,
}: {
  schema: ChildSchema;
  title: string;
  items?: T[];
  loading?: boolean;
  error?: string;
  empty: string;
  render: (item: T) => ReactNode;
  onAdd: () => void;
  onEdit: (item: Record<string, unknown>) => void;
  onDelete: (item: Record<string, unknown>) => void;
}) {
  return (
    <section className="rounded-xl border border-card-border bg-card p-5 shadow-xs md:p-6">
      <SectionTitle
        action={
          <div className="flex items-center gap-3">
            <span className="kicker text-muted-foreground">{items?.length ?? 0} bản ghi</span>
            <Button
              type="button"
              size="sm"
              onClick={onAdd}
              data-testid={`button-add-${schema.table}`}
            >
              <Plus className="mr-1.5 size-3.5" /> Thêm
            </Button>
          </div>
        }
      >
        {title}
      </SectionTitle>

      {loading ? (
        <LoadingBlock rows={3} />
      ) : error ? (
        <p className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </p>
      ) : !items?.length ? (
        <EmptyState label={empty} detail="Bấm “Thêm” để tạo bản ghi đầu tiên." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative rounded-lg border border-border bg-background p-4"
              data-testid={`row-${schema.table}-${item.id}`}
            >
              <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => onEdit(item as unknown as Record<string, unknown>)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Sửa"
                  data-testid={`button-edit-${item.id}`}
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item as unknown as Record<string, unknown>)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Xoá"
                  data-testid={`button-delete-${item.id}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              {render(item)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
