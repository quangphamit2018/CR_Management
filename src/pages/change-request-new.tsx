import { useLocation } from 'wouter';

import { useCreateChangeRequest } from '@/lib/api';
import type { ChangeRequestInput } from '@/lib/types';
import { ChangeRequestForm } from '@/components/change-request-form';
import { PageHeading } from '@/components/cr-ui';
import { useToast } from '@/hooks/use-toast';

export default function NewChangeRequest() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const create = useCreateChangeRequest();

  const submit = (data: ChangeRequestInput) =>
    create.mutate(data, {
      onSuccess: (created) => {
        toast({ title: 'Đã tạo', description: `${created.cr_id} đã được ghi nhận.` });
        setLocation(`/change-requests/${created.id}`);
      },
      onError: (error) =>
        toast({
          title: 'Tạo thất bại',
          description: error.message,
          variant: 'destructive',
        }),
    });

  return (
    <div data-testid="page-new-change-request">
      <PageHeading
        eyebrow="Register / new record"
        title="Ghi nhận change request"
        description="Nhập hình hài nghiệp vụ trước. Hồ sơ bằng chứng và cổng release có thể bổ sung khi công việc chạy."
      />
      <div className="max-w-4xl rounded-xl border border-card-border bg-card p-5 shadow-xs md:p-8">
        <ChangeRequestForm
          pending={create.isPending}
          error={create.error?.message ?? null}
          onSubmit={submit}
          onCancel={() => setLocation('/change-requests')}
        />
      </div>
    </div>
  );
}
