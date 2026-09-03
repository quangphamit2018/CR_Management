import { type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Activity,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  LogOut,
  Settings2,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useHealthCheck } from '@/lib/api';

const NAV = [
  { href: '/dashboard', label: 'Control room', icon: LayoutDashboard },
  { href: '/change-requests', label: 'Change register', icon: ClipboardList },
  { href: '/settings', label: 'Workspace', icon: Settings2 },
];

function initials(value: string): string {
  const cleaned = value.split('@')[0].replace(/[._-]+/g, ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, signOut } = useAuth();
  const health = useHealthCheck();

  const online = health.data?.status === 'ok';
  const label = user?.email ?? 'Anonymous session';

  return (
    <div className="min-h-[100dvh] bg-background text-foreground md:flex">
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground md:flex">
        <Link
          href="/dashboard"
          className="mb-9 flex items-center gap-3 px-2"
          data-testid="link-brand"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Gauge className="size-5" strokeWidth={2.5} />
          </span>
          <span>
            <span className="block text-[14px] font-extrabold tracking-tight">
              CR Management
            </span>
            <span className="kicker text-sidebar-foreground/50">
              operations desk
            </span>
          </span>
        </Link>

        <div className="kicker mb-3 px-2 text-sidebar-foreground/45">
          Workspace
        </div>
        <nav className="space-y-1" aria-label="Primary navigation">
          {NAV.map(({ href, label: navLabel, icon: Icon }) => {
            const active =
              location === href ||
              (href === '/change-requests' &&
                location.startsWith('/change-requests/'));
            return (
              <Link
                href={href}
                key={href}
                data-testid={`link-nav-${navLabel.toLowerCase().replaceAll(' ', '-')}`}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  active &&
                    'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground',
                )}
              >
                <Icon className="size-[17px]" />
                {navLabel}
                {active && (
                  <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary-foreground/70" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3.5">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold">
            <span
              className={cn(
                'size-2 rounded-full',
                online
                  ? 'bg-emerald-400'
                  : health.isLoading
                    ? 'bg-amber-400'
                    : 'bg-red-400',
              )}
            />
            {online
              ? 'Supabase connected'
              : health.isLoading
                ? 'Checking…'
                : 'Connection issue'}
          </div>
          <p className="text-[11px] leading-relaxed text-sidebar-foreground/50">
            {online
              ? `${health.data?.rows ?? 0} change requests in store`
              : (health.data?.message ?? 'Waiting for the API')}
            <br />
            Operational workspace · v1.0
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur-md md:px-9">
          <div className="flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground md:hidden">
              <Gauge className="size-4" />
            </div>
            <div>
              <span className="kicker hidden text-muted-foreground md:block">
                Change operations /
              </span>
              <span className="text-[13px] font-bold md:hidden">
                CR Management
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 text-[11px] font-semibold text-muted-foreground sm:flex">
              {online ? (
                <Wifi className="size-3.5 text-emerald-600" />
              ) : (
                <WifiOff className="size-3.5 text-red-500" />
              )}
              {online ? 'Connected' : 'Offline'}
            </div>
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <span className="grid size-8 place-items-center rounded-full bg-accent text-xs font-extrabold text-accent-foreground">
                {initials(label)}
              </span>
              <span
                className="hidden max-w-[180px] truncate text-xs font-bold sm:inline"
                data-testid="text-current-user"
              >
                {label}
              </span>
              {user && (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  title="Đăng xuất"
                  aria-label="Đăng xuất"
                  className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  data-testid="button-sign-out"
                >
                  <LogOut className="size-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="page-enter mx-auto w-full max-w-[1480px] px-5 py-7 md:px-9 md:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        <div className="kicker mb-2 text-muted-foreground">{eyebrow}</div>
        <h1 className="text-3xl font-extrabold tracking-[-0.045em] md:text-[38px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  Draft: 'bg-secondary text-secondary-foreground',
  New: 'bg-slate-100 text-slate-800',
  Submitted: 'bg-blue-100 text-blue-800',
  'In Review': 'bg-violet-100 text-violet-800',
  'In Progress': 'bg-indigo-100 text-indigo-800',
  Approved: 'bg-emerald-100 text-emerald-800',
  'In UAT': 'bg-amber-100 text-amber-900',
  UAT: 'bg-amber-100 text-amber-900',
  'On Hold': 'bg-orange-100 text-orange-900',
  Released: 'bg-teal-100 text-teal-800',
  Blocked: 'bg-red-100 text-red-800',
  Cancelled: 'bg-zinc-200 text-zinc-700',
  Pass: 'bg-emerald-100 text-emerald-800',
  Passed: 'bg-emerald-100 text-emerald-800',
  Fail: 'bg-red-100 text-red-800',
  Failed: 'bg-red-100 text-red-800',
  Planned: 'bg-blue-100 text-blue-800',
  Ready: 'bg-teal-100 text-teal-800',
  Deployed: 'bg-emerald-100 text-emerald-800',
  'Not Started': 'bg-secondary text-secondary-foreground',
};

export function StatusBadge({ status }: { status?: string | null }) {
  const value = status || 'Unknown';
  return (
    <span
      data-testid={`status-badge-${value.toLowerCase().replaceAll(' ', '-')}`}
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-[.08em]',
        STATUS_STYLES[value] || 'bg-secondary text-secondary-foreground',
      )}
    >
      {value}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority?: string | null }) {
  const value = priority || 'Normal';
  const key = value.toLowerCase();
  return (
    <span
      className={cn(
        'text-[11px] font-extrabold',
        key === 'critical'
          ? 'text-destructive'
          : key === 'high'
            ? 'text-amber-700'
            : 'text-muted-foreground',
      )}
    >
      {value}
    </span>
  );
}

export function StatCard({
  label,
  value,
  detail,
  accent = false,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  accent?: boolean;
  icon: typeof Activity;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-card-border bg-card p-5 shadow-xs',
        accent && 'border-primary/30 bg-primary text-primary-foreground',
      )}
    >
      <div className="mb-6 flex items-start justify-between">
        <span
          className={cn(
            'kicker',
            accent ? 'text-primary-foreground/60' : 'text-muted-foreground',
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            'grid size-8 place-items-center rounded-lg',
            accent ? 'bg-primary-foreground/15' : 'bg-secondary',
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="text-3xl font-extrabold tracking-[-.05em]">{value}</div>
      <div
        className={cn(
          'mt-1 text-xs',
          accent ? 'text-primary-foreground/65' : 'text-muted-foreground',
        )}
      >
        {detail}
      </div>
      {accent && (
        <div className="absolute -right-8 -top-8 size-28 rounded-full border-[12px] border-primary-foreground/10" />
      )}
    </div>
  );
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" data-testid="loading-state">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-12 animate-pulse rounded-lg bg-secondary"
        />
      ))}
    </div>
  );
}

export function ErrorState({
  onRetry,
  message,
}: {
  onRetry?: () => void;
  message?: string;
}) {
  return (
    <div
      className="rounded-xl border border-destructive/25 bg-destructive/5 p-8 text-center"
      data-testid="error-state"
    >
      <ShieldCheck className="mx-auto mb-3 size-7 text-destructive" />
      <p className="font-bold">Không tải được dữ liệu</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {message ||
          'Kiểm tra kết nối Supabase, quyền RLS và biến môi trường rồi thử lại.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
          data-testid="button-retry"
        >
          Thử lại
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  label = 'Chưa có dữ liệu',
  detail = 'Khi có bản ghi, chúng sẽ hiển thị tại đây.',
}: {
  label?: string;
  detail?: string;
}) {
  return (
    <div
      className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center"
      data-testid="empty-state"
    >
      <Activity className="mx-auto mb-3 size-7 text-muted-foreground/50" />
      <p className="font-bold">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

export function MetricBars({
  items,
  color = 'bg-primary',
}: {
  items?: { label: string; value: number }[];
  color?: string;
}) {
  if (!items?.length) return <EmptyState label="Chưa có số liệu" detail="" />;
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-4">
      {items.slice(0, 6).map((item) => (
        <div
          key={item.label}
          data-testid={`metric-${item.label.toLowerCase().replaceAll(' ', '-')}`}
        >
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="truncate pr-3 font-semibold">{item.label}</span>
            <span className="font-mono text-muted-foreground">
              {item.value}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn('h-full rounded-full', color)}
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-extrabold">{children}</h2>
      {action}
    </div>
  );
}
