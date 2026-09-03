import { type ReactNode, useState } from 'react';
import {
  Check,
  Database,
  Globe2,
  KeyRound,
  LogOut,
  RefreshCw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';

import { useHealthCheck } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ALLOW_ANONYMOUS, SUPABASE_URL } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { PageHeading } from '@/components/cr-ui';

export default function Settings() {
  const health = useHealthCheck();
  const { user, signOut } = useAuth();
  const [compact, setCompact] = useState(true);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const online = health.data?.status === 'ok';
  const host = (() => {
    try {
      return new URL(SUPABASE_URL).host;
    } catch {
      return SUPABASE_URL;
    }
  })();

  return (
    <div data-testid="page-settings">
      <PageHeading
        eyebrow="Workspace / preferences"
        title="Cấu hình workspace"
        description="Giữ bàn làm việc vận hành khớp với nhịp làm việc của nhóm và hợp đồng kết nối."
        action={
          <Button onClick={save} data-testid="button-save-settings">
            {saved ? (
              <Check className="mr-2 size-4" />
            ) : (
              <SlidersHorizontal className="mr-2 size-4" />
            )}
            {saved ? 'Đã lưu' : 'Lưu tuỳ chọn'}
          </Button>
        }
      />

      <div className="grid max-w-5xl gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-xl border border-card-border bg-card p-5 shadow-xs md:p-7">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-secondary">
              <SlidersHorizontal className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold">Tuỳ chọn hiển thị</h2>
              <p className="text-xs text-muted-foreground">
                Các tuỳ chọn này chỉ áp dụng trong phiên hiện tại.
              </p>
            </div>
          </div>
          <div className="space-y-1 divide-y divide-border">
            <SettingRow label="Bảng dày dòng" detail="Hiển thị nhiều bản ghi hơn trước khi cuộn">
              <button
                onClick={() => setCompact(!compact)}
                className={`relative h-6 w-11 rounded-full ${compact ? 'bg-primary' : 'bg-secondary'}`}
                data-testid="switch-dense-register"
                aria-label="Bảng dày dòng"
              >
                <span
                  className={`absolute top-1 size-4 rounded-full bg-background shadow-sm ${compact ? 'left-6' : 'left-1'}`}
                />
              </button>
            </SettingRow>
            <SettingRow
              label="Xác nhận hành động phá huỷ"
              detail="Hỏi lại trước khi xoá một change request"
            >
              <span className="grid size-5 place-items-center rounded border border-primary bg-primary text-primary-foreground">
                <Check className="size-3" />
              </span>
            </SettingRow>
          </div>
        </section>

        <section className="rounded-xl border border-card-border bg-card p-5 shadow-xs md:p-7">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-accent">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold">Trạng thái kết nối</h2>
              <p className="text-xs text-muted-foreground">
                Tình trạng dịch vụ và thông tin tích hợp.
              </p>
            </div>
          </div>

          <div
            className={`rounded-lg border p-4 ${
              online
                ? 'border-emerald-200 bg-emerald-50/70'
                : 'border-destructive/25 bg-destructive/5'
            }`}
          >
            <div
              className={`flex items-center gap-2 text-xs font-extrabold ${
                online ? 'text-emerald-800' : 'text-destructive'
              }`}
            >
              <span
                className={`size-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-destructive'}`}
              />
              {online
                ? 'Hệ thống hoạt động bình thường'
                : health.isLoading
                  ? 'Đang kiểm tra kết nối'
                  : 'Kết nối đang có vấn đề'}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed opacity-80">
              {online
                ? `Đọc được ${health.data?.rows ?? 0} bản ghi từ bảng change_requests.`
                : (health.data?.message ??
                  'Kiểm tra URL, khoá anon và chính sách RLS trong Supabase.')}
            </p>
          </div>

          <div className="mt-5 space-y-3">
            <Connection icon={Server} label="Supabase project" value={host} />
            <Connection icon={Database} label="Nguồn dữ liệu" value="PostgREST /rest/v1" />
            <Connection
              icon={KeyRound}
              label="Phiên đăng nhập"
              value={user?.email ?? (ALLOW_ANONYMOUS ? 'anon (RLS mở)' : 'chưa đăng nhập')}
            />
            <Connection
              icon={Globe2}
              label="Môi trường"
              value={import.meta.env.PROD ? 'production' : 'development'}
            />
          </div>

          <Button
            variant="outline"
            className="mt-6 w-full"
            onClick={() => void health.refetch()}
            disabled={health.isFetching}
            data-testid="button-refresh-health"
          >
            <RefreshCw className={`mr-2 size-4 ${health.isFetching ? 'animate-spin' : ''}`} />
            Kiểm tra lại kết nối
          </Button>

          {user && (
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => void signOut()}
              data-testid="button-settings-sign-out"
            >
              <LogOut className="mr-2 size-4" />
              Đăng xuất
            </Button>
          )}
        </section>
      </div>

      <div className="mt-5 max-w-5xl rounded-xl border border-border bg-secondary/40 p-5">
        <div className="flex items-start gap-3">
          <div className="kicker mt-0.5 shrink-0 text-muted-foreground">Về workspace</div>
          <p className="max-w-xl text-xs leading-5 text-muted-foreground">
            CR Management là bản ghi tập trung cho vòng đời yêu cầu thay đổi, hồ sơ bằng
            chứng, UAT và mức sẵn sàng release. Giữ tracker gần tay, đẩy file Excel ra khỏi
            đường găng.
          </p>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  detail,
  children,
}: {
  label: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className="text-xs font-bold">{label}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
      </div>
      {children}
    </div>
  );
}

function Connection({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Server;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-xs font-semibold">{label}</span>
      <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">
        {value}
      </span>
    </div>
  );
}
