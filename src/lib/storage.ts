import { supabase, toError } from '@/lib/supabase';

/** Bucket riêng tư được tạo trong `supabase/01_schema_and_seed.sql`. */
export const CR_BUCKET = 'cr-files';

/** Giới hạn phía bucket là 50 MB (file_size_limit = 52428800). */
export const MAX_FILE_BYTES = 52_428_800;

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'text/csv',
  'message/rfc822',
  'application/zip',
  'image/png',
  'image/jpeg',
];

export interface UploadedFile {
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number;
}

/** Bỏ dấu và ký tự lạ để đường dẫn trong Storage luôn an toàn. */
function slugifyFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : '';
  const cleaned = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
  return `${cleaned || 'file'}${ext}`;
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/**
 * Tải file lên bucket riêng tư. Đường dẫn theo cấu trúc
 * `<cr_uuid>/<doc_type>/<timestamp>_<ten_file>` để không đè lên nhau.
 */
export async function uploadCrFile(
  crId: string,
  docType: string,
  file: File,
): Promise<UploadedFile> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `File ${formatBytes(file.size)} vượt giới hạn ${formatBytes(MAX_FILE_BYTES)} của bucket.`,
    );
  }

  const path = `${crId}/${docType}/${Date.now()}_${slugifyFileName(file.name)}`;
  const { error } = await supabase.storage.from(CR_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) throw toError(error);

  return {
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    file_size: file.size,
  };
}

/**
 * Sinh signed URL ngắn hạn để tải file. Bucket là private nên đây là
 * cách duy nhất để mở file từ trình duyệt.
 */
export async function createSignedUrl(
  path: string,
  expiresInSeconds = 300,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CR_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw toError(error);
  if (!data?.signedUrl) throw new Error('Supabase không trả về signed URL.');
  return data.signedUrl;
}

/** Mở file trong tab mới bằng signed URL vừa tạo. */
export async function openCrFile(path: string): Promise<void> {
  const url = await createSignedUrl(path);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Xoá object khỏi Storage. Lỗi ở đây không nên chặn thao tác chính. */
export async function removeCrFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(CR_BUCKET).remove([path]);
  if (error) {
    console.warn('Không xoá được file trên Storage:', toError(error).message);
  }
}
