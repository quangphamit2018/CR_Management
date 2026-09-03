import { AlertCircle } from 'lucide-react';
import { Link } from 'wouter';

import { Card, CardContent } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <Card className="mx-4 w-full max-w-md">
        <CardContent className="pt-6">
          <div className="mb-4 flex gap-2">
            <AlertCircle className="size-8 text-destructive" />
            <h1 className="text-2xl font-bold">404 — Không tìm thấy trang</h1>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Đường dẫn này không tồn tại trong workspace.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            data-testid="link-back-dashboard"
          >
            Về control room
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
