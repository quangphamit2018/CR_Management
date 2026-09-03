import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cấu hình kết nối Supabase.
 *
 * Thứ tự ưu tiên:
 *   1. Biến môi trường VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 *      (hoặc VITE_SUPABASE_ANON_KEY — hỗ trợ cả hai tên gọi).
 *   2. Giá trị mặc định bên dưới (project hiện tại).
 *
 * Anon / publishable key là key dành cho trình duyệt, được Supabase thiết kế để
 * lộ công khai; bảo mật thực sự nằm ở Row Level Security trong Postgres.
 * TUYỆT ĐỐI không đưa service_role key vào project frontend này.
 */
const FALLBACK_URL = 'https://rnsjiqbbeywgbnqsojce.supabase.co';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuc2ppcWJiZXl3Z2JucXNvamNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0OTExNjAsImV4cCI6MjA5MzA2NzE2MH0.1BrlS__GNAMFbBmudl6gUJwJ9j_zoDdAj9rtfhBkhdk';

function readEnv(key: string): string | undefined {
  try {
    const env = import.meta.env as Record<string, string | undefined> | undefined;
    const trimmed = env?.[key]?.trim();
    return trimmed ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function normalizeUrl(raw: string): string {
  // Chấp nhận cả trường hợp người dùng dán nhầm ".../rest/v1/" ở cuối.
  return raw
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '');
}

export const SUPABASE_URL = normalizeUrl(
  readEnv('VITE_SUPABASE_URL') ?? FALLBACK_URL,
);

export const SUPABASE_KEY =
  readEnv('VITE_SUPABASE_PUBLISHABLE_KEY') ??
  readEnv('VITE_SUPABASE_ANON_KEY') ??
  FALLBACK_KEY;

/** Bỏ qua màn hình đăng nhập (chỉ dùng khi RLS đã mở cho role `anon`). */
export const ALLOW_ANONYMOUS = readEnv('VITE_ALLOW_ANON') === 'true';

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'cr-management-auth',
    },
  },
);

/** Chuẩn hoá lỗi Supabase về Error để React Query hiển thị được. */
export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const err = error as { message: string; hint?: string; details?: string };
    return new Error(
      [err.message, err.details, err.hint].filter(Boolean).join(' — '),
    );
  }
  return new Error(String(error));
}
