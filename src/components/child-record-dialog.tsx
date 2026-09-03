import { useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, Save, Trash2, Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSaveChildRecord } from '@/lib/api';
import {
  emptyValues,
  toFormValues,
  toPayload,
  validate,
  type ChildSchema,
  type FieldDef,
} from '@/lib/child-schema';
import {
  ALLOWED_MIME_TYPES,
  formatBytes,
  removeCrFile,
  uploadCrFile,
  type UploadedFile,
} from '@/lib/storage';

interface Props {
  schema: ChildSchema;
  crId: string;
  /** Bản ghi đang sửa; bỏ trống là thêm mới. */
  record?: Record<string, unknown> | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function ChildRecordDialog({ schema, crId, record, onClose, onSaved }: Props) {
  const isEdit = Boolean(record?.id);
  const save = useSaveChildRecord(schema.table, crId);

  const [values, setValues] = useState<Record<string, unknown>>(() =>
    record ? toFormValues(schema, record) : emptyValues(schema),
  );
  const [error, setError] = useState<string | null>(null);

  // Thông tin file: giữ riêng vì 4 cột file không nằm trong `schema.fields`.
  const [file, setFile] = useState<UploadedFile | null>(
    record && record.storage_path
      ? {
          storage_path: String(record.storage_path),
          file_name: String(record.file_name ?? 'file'),
          mime_type: (record.mime_type as string | null) ?? null,
          file_size: Number(record.file_size ?? 0),
        }
      : null,
  );
  const [uploading, setUploading] = useState(false);
  /** File vừa upload trong phiên này nhưng chưa lưu — cần dọn nếu người dùng huỷ. */
  const orphanRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (name: string, value: unknown) =>
    setValues((previous) => ({ ...previous, [name]: value }));

  const cancel = () => {
    if (orphanRef.current) void removeCrFile(orphanRef.current);
    onClose();
  };

  const pickFile = async (selected: File | undefined) => {
    if (!selected) return;
    setError(null);
    setUploading(true);
    try {
      const docType = String(values.doc_type ?? 'OTHER');
      const uploaded = await uploadCrFile(crId, docType, selected);
      if (orphanRef.current) void removeCrFile(orphanRef.current);
      orphanRef.current = uploaded.storage_path;
      setFile(uploaded);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const detachFile = () => {
    if (orphanRef.current === file?.storage_path) {
      void removeCrFile(orphanRef.current);
      orphanRef.current = null;
    }
    setFile(null);
  };

  const submit = () => {
    const invalid = validate(schema, values);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);

    const payload = toPayload(schema, values);
    if (schema.hasFile) {
      payload.storage_path = file?.storage_path ?? null;
      payload.file_name = file?.file_name ?? null;
      payload.mime_type = file?.mime_type ?? null;
      payload.file_size = file?.file_size ?? null;
    }

    save.mutate(
      { id: record?.id ? String(record.id) : undefined, values: payload },
      {
        onSuccess: () => {
          orphanRef.current = null;
          onSaved?.();
          onClose();
        },
        onError: (cause) => setError(cause.message),
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-sm md:p-8"
      role="dialog"
      aria-modal="true"
      data-testid={`dialog-${schema.table}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-card-border bg-card shadow-lg">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="kicker text-muted-foreground">
              {isEdit ? 'Cập nhật' : 'Thêm mới'}
            </div>
            <h2 className="mt-1 text-base font-extrabold capitalize">
              {schema.singular}
            </h2>
          </div>
          <button
            type="button"
            onClick={cancel}
            className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Đóng"
            data-testid="button-dialog-close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="max-h-[65vh] overflow-y-auto px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {schema.fields.map((field) => (
              <div
                key={field.name}
                className={field.span === 2 ? 'sm:col-span-2' : undefined}
              >
                <FieldInput
                  field={field}
                  value={values[field.name]}
                  onChange={(value) => set(field.name, value)}
                />
              </div>
            ))}
          </div>

          {schema.hasFile && (
            <div className="mt-6 rounded-xl border border-dashed border-border bg-secondary/30 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-extrabold">
                <Paperclip className="size-4" /> Tệp đính kèm
              </div>

              {file ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold" data-testid="text-attached-file">
                      {file.file_name}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {formatBytes(file.file_size)} · {file.mime_type || 'không rõ định dạng'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={detachFile}
                    className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Gỡ tệp"
                    data-testid="button-detach-file"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Chưa có tệp. Bucket giới hạn 50 MB, chỉ nhận PDF, Word, Excel, CSV,
                  .eml, .zip, PNG và JPEG.
                </p>
              )}

              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept={ALLOWED_MIME_TYPES.join(',')}
                onChange={(event) => void pickFile(event.target.files?.[0])}
                data-testid="input-file"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                data-testid="button-upload-file"
              >
                {uploading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 size-4" />
                )}
                {uploading ? 'Đang tải lên…' : file ? 'Thay tệp khác' : 'Chọn tệp'}
              </Button>
            </div>
          )}

          {error && (
            <p
              className="mt-4 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive"
              data-testid="text-dialog-error"
            >
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={cancel}>
            Huỷ
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={save.isPending || uploading}
            data-testid="button-dialog-save"
          >
            {save.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            {save.isPending ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Thêm bản ghi'}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `field-${field.name}`;
  const text = value === null || value === undefined ? '' : String(value);

  if (field.kind === 'checkbox') {
    return (
      <label className="flex items-center gap-3 pt-6 text-xs font-bold">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="size-4 rounded border-input"
          data-testid={`input-${field.name}`}
        />
        {field.label}
      </label>
    );
  }

  const label = (
    <Label htmlFor={id} className="mb-2 block">
      {field.label}
      {field.required && <span className="ml-1 text-destructive">*</span>}
    </Label>
  );

  if (field.kind === 'textarea') {
    return (
      <>
        {label}
        <Textarea
          id={id}
          value={text}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[84px] resize-y"
          data-testid={`input-${field.name}`}
        />
      </>
    );
  }

  if (field.kind === 'select') {
    return (
      <>
        {label}
        <select
          id={id}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          data-testid={`input-${field.name}`}
        >
          {!field.required && <option value="">—</option>}
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </>
    );
  }

  const inputType =
    field.kind === 'number'
      ? 'number'
      : field.kind === 'date'
        ? 'date'
        : field.kind === 'datetime'
          ? 'datetime-local'
          : 'text';

  return (
    <>
      {label}
      <Input
        id={id}
        type={inputType}
        value={text}
        placeholder={field.placeholder}
        onChange={(event) =>
          onChange(
            field.kind === 'number'
              ? event.target.value === ''
                ? 0
                : Number(event.target.value)
              : event.target.value,
          )
        }
        data-testid={`input-${field.name}`}
      />
    </>
  );
}
