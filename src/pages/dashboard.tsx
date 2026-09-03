import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Layers3,
} from 'lucide-react';
import { Link } from 'wouter';

import { useGetDashboardSummary, useHealthCheck } from '@/lib/api';
import {
  EmptyState,
  ErrorState,
  LoadingBlock,
  MetricBars,
  PageHeading,
  SectionTitle,
  StatCard,
  StatusBadge,
} from '@/components/cr-ui';

export default function Dashboard() {
  const summary = useGetDashboardSummary();
  const health = useHealthCheck();

  if (summary.isLoading) {
    return (
      <>
        <PageHeading
          eyebrow="Control room / today"
          title="Change health"
          description="Bức tranh trực tiếp về những gì đang cần xử lý trong hàng đợi thay đổi."
        />
        <LoadingBlock rows={6} />
      </>
    );
  }

  if (summary.isError) {
    return (
      <ErrorState
        onRetry={() => void summary.refetch()}
        message={summary.error?.message}
      />
    );
  }

  const data = summary.data;
  const activity = data?.recent_activity ?? [];
  const statuses = data?.by_status ?? [];

  return (
    <div data-testid="page-dashboard">
      <PageHeading
        eyebrow="Control room / today"
        title="Change health"
        description="Bức tranh trực tiếp về những gì đang cần xử lý trong hàng đợi thay đổi."
        action={
          <Link
            href="/change-requests/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground shadow-sm hover:-translate-y-0.5"
            data-testid="link-create-dashboard"
          >
            Ghi nhận thay đổi <ArrowUpRight className="ml-2 size-4" />
          </Link>
        }
      />

      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tổng change request"
          value={data?.total ?? 0}
          detail={`${data?.released ?? 0} đã release`}
          icon={Layers3}
        />
        <StatCard
          label="Tiến độ trung bình"
          value={`${Math.round(data?.average_progress ?? 0)}%`}
          detail="Bình quân trên toàn bộ hồ sơ"
          accent
          icon={Gauge}
        />
        <StatCard
          label="Critical + High"
          value={data?.critical_high ?? 0}
          detail="Cần theo dõi sát"
          icon={CircleAlert}
        />
        <StatCard
          label="Trạng thái dịch vụ"
          value={health.data?.status === 'ok' ? 'Online' : 'Đang kiểm tra'}
          detail="Kết nối Supabase"
          icon={CheckCircle2}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_.9fr]">
        <section className="rounded-xl border border-card-border bg-card p-5 shadow-xs md:p-6">
          <SectionTitle
            action={<span className="kicker text-muted-foreground">hàng đợi hiện tại</span>}
          >
            Pipeline theo vòng đời
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statuses.slice(0, 8).map((item, index) => (
              <div
                className="relative overflow-hidden rounded-lg border border-border bg-background p-4"
                key={item.label}
                data-testid={`pipeline-${item.label.toLowerCase().replaceAll(' ', '-')}`}
              >
                <div className="mb-5 flex items-center justify-between">
                  <StatusBadge status={item.label} />
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="text-3xl font-extrabold tracking-[-.06em]">
                  {item.value}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  hồ sơ ở giai đoạn này
                </div>
                <div
                  className="absolute bottom-0 left-0 h-1 rounded-full bg-primary"
                  style={{
                    width: `${Math.min(100, Math.max(13, (item.value / Math.max(1, data?.total ?? 1)) * 100))}%`,
                  }}
                />
              </div>
            ))}
          </div>
          {statuses.length === 0 && (
            <EmptyState
              label="Pipeline đang trống"
              detail="Chưa có bản ghi nào trong bảng change_requests."
            />
          )}
        </section>

        <section className="rounded-xl border border-card-border bg-card p-5 shadow-xs md:p-6">
          <SectionTitle
            action={<span className="kicker text-muted-foreground">phân bổ</span>}
          >
            Theo ứng dụng
          </SectionTitle>
          <MetricBars items={data?.by_application} color="bg-chart-2" />
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-card-border bg-card p-5 shadow-xs md:p-6">
          <SectionTitle
            action={<span className="kicker text-muted-foreground">khối lượng</span>}
          >
            Theo người phụ trách
          </SectionTitle>
          <MetricBars items={data?.by_owner} color="bg-chart-3" />
        </section>

        <section className="rounded-xl border border-card-border bg-card p-5 shadow-xs md:p-6">
          <SectionTitle
            action={<span className="kicker text-muted-foreground">mới nhất</span>}
          >
            Hoạt động gần đây
          </SectionTitle>
          <div className="space-y-1">
            {activity.slice(0, 6).map((entry) => (
              <div
                key={entry.id}
                className="flex gap-3 border-b border-border py-3 last:border-0"
                data-testid={`activity-${entry.id}`}
              >
                <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-secondary">
                  <Activity className="size-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate text-xs font-bold">{entry.activity}</p>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {new Date(entry.occurred_at).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {entry.cr_code ?? 'Workspace'}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {activity.length === 0 && <EmptyState label="Chưa có hoạt động nào" detail="" />}
        </section>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section className="rounded-xl border border-card-border bg-card p-5 shadow-xs">
          <SectionTitle>Theo phân loại</SectionTitle>
          <MetricBars items={data?.by_category} color="bg-chart-1" />
        </section>
        <section className="rounded-xl border border-card-border bg-card p-5 shadow-xs">
          <SectionTitle>Theo mức ưu tiên</SectionTitle>
          <MetricBars items={data?.by_priority} color="bg-chart-4" />
        </section>
      </div>
    </div>
  );
}
