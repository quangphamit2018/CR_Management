import { useState, type FormEvent, type ReactNode } from 'react';
import { Gauge, Loader2, LogIn, ShieldAlert, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { SUPABASE_URL } from '@/lib/supabase';

export function AuthGate({ children }: { children: ReactNode }) {
  const { authorized, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-background">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Đang kiểm tra phiên đăng nhập…
        </div>
      </div>
    );
  }

  if (!authorized) return <SignInScreen />;
  return <>{children}</>;
}

function SignInScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        setNotice(await signUp(email, password));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  };

  const host = (() => {
    try {
      return new URL(SUPABASE_URL).host;
    } catch {
      return SUPABASE_URL;
    }
  })();

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-secondary/40 px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Gauge className="size-6" strokeWidth={2.5} />
          </span>
          <div>
            <div className="text-[15px] font-extrabold tracking-tight">
              CR Management
            </div>
            <div className="kicker text-muted-foreground">operations desk</div>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-card-border bg-card p-6 shadow-xs md:p-7"
          data-testid="form-auth"
        >
          <h1 className="text-xl font-extrabold tracking-tight">
            {mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </h1>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            Dữ liệu được bảo vệ bằng Row Level Security của Supabase, nên bắt
            buộc phải đăng nhập mới đọc/ghi được.
          </p>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ban@congty.com"
                data-testid="input-auth-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Mật khẩu</Label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                data-testid="input-auth-password"
              />
            </div>
          </div>

          {error && (
            <div
              className="mt-4 flex gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive"
              data-testid="text-auth-error"
            >
              <ShieldAlert className="mt-px size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              {notice}
            </div>
          )}

          <Button
            type="submit"
            className="mt-6 w-full"
            disabled={pending}
            data-testid="button-auth-submit"
          >
            {pending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : mode === 'signin' ? (
              <LogIn className="mr-2 size-4" />
            ) : (
              <UserPlus className="mr-2 size-4" />
            )}
            {mode === 'signin' ? 'Đăng nhập' : 'Đăng ký'}
          </Button>

          <button
            type="button"
            className="mt-4 w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
              setNotice(null);
            }}
            data-testid="button-auth-toggle-mode"
          >
            {mode === 'signin'
              ? 'Chưa có tài khoản? Đăng ký'
              : 'Đã có tài khoản? Đăng nhập'}
          </button>
        </form>

        <p className="mt-5 text-center font-mono text-[10px] text-muted-foreground">
          {host}
        </p>
      </div>
    </div>
  );
}
