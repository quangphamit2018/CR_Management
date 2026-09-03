import { useMemo, useState } from 'react';
import { Filter, Plus, Search, Trash2, X } from 'lucide-react';
import { Link } from 'wouter';

import { useDeleteChangeRequest, useListChangeRequests } from '@/lib/api';
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeading,
  PriorityBadge,
  StatusBadge,
} from '@/components/cr-ui';

type SortKey = 'updated_at' | 'target_date' | 'progress' | 'cr_id';

export default function ChangeRequests() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [sort, setSort] = useState<SortKey>('cr_id');
  const [showFilters, setShowFilters] = useState(false);

  const query = useListChangeRequests({
    search: search || undefined,
    status: status || undefined,
    priority: priority || undefined,
    sort,
  });
  const remove = useDeleteChangeRequest();
  const rows = useMemo(() => query.data ?? [], [query.data]);

  const clear = () => {
    setSearch('');
    setStatus('');
    setPriority('');
  };

  const doDelete = (id: string, code: string) => {
    if (!window.confirm(`Xoá ${code}? Thao tác này không thể hoàn tác.`)) return;
    remove.mutate(
      { id },
      {
        onSuccess: () =>
          toast({ title: 'Đã xoá', description: `${code} đã được xoá khỏi hệ thống.` }),
        onError: (error) =>
          toast({
            title: 'Xoá thất bại',
            description: error.message,
            variant: 'destructive',
          }),
      },
    );
  };

  return (
    <div data-testid="page-change-requests">
      <PageHeading
        eyebrow="Register / all records"
        title="Sổ đăng ký thay đổi"
        description="Nguồn dữ liệu gốc cho mọi yêu cầu, người phụ trách, mốc thời gian và cổng kiểm soát tiếp theo."
        action={
          <Link
            href="/change-requests/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground hover:-translate-y-0.5"
            data-testid="link-create-change-request"
          >
            <Plus className="mr-2 size-4" /> Tạo change request
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-card-border bg-card p-3 shadow-xs md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="border-0 bg-background pl-9 shadow-none focus-visible:ring-1"
            placeholder="Tìm mã CR, tiêu đề, ứng dụng, người phụ trách…"
            data-testid="input-search-change-requests"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          data-testid="button-toggle-filters"
        >
          <Filter className="mr-2 size-4" /> Bộ lọc
          {(status || priority) && (
            <span className="ml-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
              !
            </span>
          )}
        </Button>
        <label className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
          <span className="hidden sm:inline">Sắp xếp</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs font-semibold text-foreground outline-none"
            data-testid="select-sort-requests"
          >
            <option value="cr_id">Mã CR</option>
            <option value="updated_at">Cập nhật gần nhất</option>
            <option value="target_date">Ngày mục tiêu</option>
            <option value="progress">Tiến độ</option>
          </select>
        </label>
        {(status || priority || search) && (
          <button
            onClick={clear}
            className="flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            data-testid="button-clear-filters"
            aria-label="Xoá bộ lọc"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {showFilters && (
        <div className="mb-4 grid gap-3 rounded-xl border border-border bg-secondary/40 p-4 sm:grid-cols-2">
          <label className="text-xs font-bold">
            Trạng thái vòng đời
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-input bg-card px-3 text-sm font-medium outline-none"
              data-testid="select-status-filter"
            >
              <option value="">Tất cả trạng thái</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold">
            Mức ưu tiên
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-input bg-card px-3 text-sm font-medium outline-none"
              data-testid="select-priority-filter"
            >
              <option value="">Tất cả mức ưu tiên</option>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {query.isLoading ? (
        <LoadingBlock rows={7} />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} message={query.error?.message} />
      ) : rows.length === 0 ? (
        <EmptyState
          label="Không có change request nào khớp"
          detail="Thử từ khoá khác hoặc tạo mới bản ghi."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-card-border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b border-border bg-secondary/35 px-4 py-3">
            <span className="kicker text-muted-foreground">
              {rows.length} bản ghi / sổ đăng ký trực tiếp
            </span>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">
              {sort}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="border-b border-border bg-background/70 text-[10px] uppercase tracking-[.12em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-bold">Yêu cầu</th>
                  <th className="px-4 py-3 font-bold">Giai đoạn</th>
                  <th className="px-4 py-3 font-bold">Phụ trách</th>
                  <th className="px-4 py-3 font-bold">Ưu tiên</th>
                  <th className="px-4 py-3 font-bold">Tiến độ</th>
                  <th className="px-4 py-3 font-bold">Mục tiêu</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className="data-row group border-b border-border last:border-0 hover:bg-secondary/35"
                    style={{ animationDelay: `${index * 35}ms` }}
                    data-testid={`row-change-request-${row.id}`}
                  >
                    <td className="px-4 py-4">
                      <Link
                        href={`/change-requests/${row.id}`}
                        className="group/link block"
                        data-testid={`link-change-request-${row.id}`}
                      >
                        <span className="font-mono text-[10px] font-medium text-muted-foreground">
                          {row.cr_id}
                        </span>
                        <span className="mt-1 block max-w-[290px] truncate text-sm font-extrabold group-hover/link:text-primary">
                          {row.title}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {row.application || 'Chưa gán ứng dụng'} · {row.category}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-4 text-xs font-semibold">
                      {row.owner || <span className="text-muted-foreground">Chưa gán</span>}
                    </td>
                    <td className="px-4 py-4">
                      <PriorityBadge priority={row.priority} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, Number(row.progress ?? 0))}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {Math.round(Number(row.progress ?? 0))}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-[11px] text-muted-foreground">
                      {row.target_date
                        ? new Date(row.target_date).toLocaleDateString('vi-VN')
                        : '—'}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        disabled={remove.isPending}
                        onClick={() => doDelete(row.id, row.cr_id)}
                        className="rounded-md p-2 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                        aria-label={`Xoá ${row.cr_id}`}
                        data-testid={`button-delete-${row.id}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
