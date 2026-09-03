import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  APPROVAL_OPTIONS,
  CATEGORY_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  type ChangeRequest,
  type ChangeRequestInput,
} from '@/lib/types';

const optionalText = z.string().optional();

const isoDate = z
  .string()
  .optional()
  .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value.trim()), {
    message: 'Định dạng ngày phải là YYYY-MM-DD',
  });

const schema = z.object({
  cr_id: z.string().trim().min(1, 'Bắt buộc nhập mã CR'),
  title: z.string().trim().min(1, 'Bắt buộc nhập tiêu đề'),
  application: optionalText,
  requester: optionalText,
  department: optionalText,
  category: z.string().min(1, 'Bắt buộc chọn phân loại'),
  priority: z.string().min(1, 'Bắt buộc chọn mức ưu tiên'),
  status: z.string().min(1, 'Bắt buộc chọn trạng thái'),
  approval_status: optionalText,
  owner: optionalText,
  request_date: isoDate,
  target_date: isoDate,
  approval_date: isoDate,
  progress: z
    .number({ invalid_type_error: 'Tiến độ phải là số' })
    .min(0, 'Từ 0 đến 100')
    .max(100, 'Từ 0 đến 100'),
  legacy_name: optionalText,
  folder_name: optionalText,
  mail_thread: optionalText,
  progress_text: optionalText,
  summary: optionalText,
  notes: optionalText,
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  cr_id: '',
  title: '',
  application: '',
  requester: '',
  department: '',
  category: 'Enhancement',
  priority: 'Medium',
  status: 'New',
  approval_status: 'Pending',
  owner: '',
  request_date: new Date().toISOString().slice(0, 10),
  target_date: '',
  approval_date: '',
  progress: 0,
  legacy_name: '',
  folder_name: '',
  mail_thread: '',
  progress_text: '',
  summary: '',
  notes: '',
};

function fromRecord(record: Partial<ChangeRequest>): FormValues {
  return {
    ...DEFAULTS,
    cr_id: record.cr_id ?? '',
    title: record.title ?? '',
    application: record.application ?? '',
    requester: record.requester ?? '',
    department: record.department ?? '',
    category: record.category ?? DEFAULTS.category,
    priority: record.priority ?? DEFAULTS.priority,
    status: record.status ?? DEFAULTS.status,
    approval_status: record.approval_status ?? '',
    owner: record.owner ?? '',
    request_date: record.request_date ?? '',
    target_date: record.target_date ?? '',
    approval_date: record.approval_date ?? '',
    progress: Number(record.progress ?? 0),
    legacy_name: record.legacy_name ?? '',
    folder_name: record.folder_name ?? '',
    mail_thread: record.mail_thread ?? '',
    progress_text: record.progress_text ?? '',
    summary: record.summary ?? '',
    notes: record.notes ?? '',
  };
}

export function ChangeRequestForm({
  initial,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<ChangeRequest>;
  pending?: boolean;
  error?: string | null;
  onSubmit: (value: ChangeRequestInput) => void;
  onCancel: () => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ? fromRecord(initial) : DEFAULTS,
  });

  const textField = (
    name: keyof FormValues,
    label: string,
    placeholder?: string,
    type: 'text' | 'number' | 'date' = 'text',
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              type={type}
              min={type === 'number' ? 0 : undefined}
              max={type === 'number' ? 100 : undefined}
              placeholder={placeholder}
              value={field.value === null || field.value === undefined ? '' : String(field.value)}
              onChange={(event) =>
                field.onChange(
                  type === 'number'
                    ? event.target.value === ''
                      ? 0
                      : Number(event.target.value)
                    : event.target.value,
                )
              }
              data-testid={`input-${name}`}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const selectField = (
    name: keyof FormValues,
    label: string,
    options: readonly string[],
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={String(field.value ?? '')}
              onChange={(event) => field.onChange(event.target.value)}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              data-testid={`select-${name}`}
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const areaField = (
    name: keyof FormValues,
    label: string,
    placeholder: string,
    minHeight = 110,
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea
              {...field}
              value={field.value === null || field.value === undefined ? '' : String(field.value)}
              placeholder={placeholder}
              className="resize-y"
              style={{ minHeight }}
              data-testid={`textarea-${name}`}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const submit = form.handleSubmit((values) => {
    onSubmit(values as ChangeRequestInput);
  });

  return (
    <Form {...form}>
      <form onSubmit={submit} className="space-y-7" data-testid="form-change-request">
        <div className="grid gap-5 md:grid-cols-2">
          {textField('cr_id', 'Mã CR', 'CR_014')}
          {textField('title', 'Tiêu đề thay đổi', 'Mô tả ngắn gọn yêu cầu')}
          {textField('application', 'Ứng dụng', 'VD: DMS, XnappReports')}
          {textField('requester', 'Người/bộ phận yêu cầu', 'VD: SFA Team')}
          {textField('department', 'Phòng ban', 'VD: DE')}
          {textField('owner', 'Người phụ trách (L2)', 'VD: Anh Hải')}
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {selectField('category', 'Phân loại', CATEGORY_OPTIONS)}
          {selectField('priority', 'Mức ưu tiên', PRIORITY_OPTIONS)}
          {selectField('status', 'Trạng thái vòng đời', STATUS_OPTIONS)}
          {selectField('approval_status', 'Trạng thái phê duyệt', APPROVAL_OPTIONS)}
          {textField('request_date', 'Ngày yêu cầu', 'YYYY-MM-DD', 'date')}
          {textField('target_date', 'Ngày mục tiêu', 'YYYY-MM-DD', 'date')}
          {textField('approval_date', 'Ngày phê duyệt', 'YYYY-MM-DD', 'date')}
          {textField('progress', 'Tiến độ (%)', '0', 'number')}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {textField('legacy_name', 'Tên cũ (legacy)', 'Nhãn tracker cũ')}
          {textField('folder_name', 'Tên thư mục', '[CR_014] ...')}
        </div>

        {areaField('mail_thread', 'Mail thread liên quan', 'Tiêu đề các mail trao đổi', 80)}
        {areaField('progress_text', 'Diễn giải tiến độ', 'VD: 31/08 nhận BRD và FSD từ InterK', 80)}
        {areaField('summary', 'Tóm tắt nghiệp vụ', 'Thay đổi cái gì, vì sao cần bây giờ?')}
        {areaField('notes', 'Ghi chú vận hành', 'Phụ thuộc, rủi ro, next action', 90)}

        {error && (
          <p
            className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive"
            data-testid="text-form-error"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            data-testid="button-cancel-form"
          >
            <ArrowLeft className="mr-2 size-4" />
            Huỷ
          </Button>
          <Button
            type="submit"
            disabled={pending}
            data-testid="button-submit-change-request"
          >
            {pending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Check className="mr-2 size-4" />
            )}
            {pending ? 'Đang lưu…' : initial?.id ? 'Lưu thay đổi' : 'Tạo change request'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
