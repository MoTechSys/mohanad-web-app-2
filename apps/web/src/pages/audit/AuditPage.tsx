import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { apiGet } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
  user?: { fullName: string; username: string };
}
interface ListResult {
  items: AuditLog[];
  meta: { total: number; totalPages: number; page: number };
}

const ACTION_LABELS: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  CREATE: { label: 'إنشاء', variant: 'success' },
  UPDATE: { label: 'تعديل', variant: 'warning' },
  DELETE: { label: 'حذف', variant: 'danger' },
  LOGIN: { label: 'دخول', variant: 'neutral' },
  LOGOUT: { label: 'خروج', variant: 'neutral' },
};

export function AuditPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, search],
    queryFn: () =>
      apiGet<ListResult>(
        `/api/v1/audit?page=${page}&limit=30${search ? `&entity=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  const columns: Column<AuditLog>[] = [
    {
      key: 'action',
      header: 'الإجراء',
      render: (r) => {
        const a = ACTION_LABELS[r.action] ?? { label: r.action, variant: 'neutral' as const };
        return <Badge variant={a.variant}>{a.label}</Badge>;
      },
    },
    {
      key: 'entity',
      header: 'الكيان',
      render: (r) => <span className="font-mono text-xs">{r.entity}</span>,
    },
    {
      key: 'entityId',
      header: 'المعرف',
      render: (r) => (
        <span className="text-xs text-gray-400 truncate max-w-24">{r.entityId ?? '—'}</span>
      ),
    },
    {
      key: 'user',
      header: 'المستخدم',
      render: (r) =>
        r.user ? (
          <span>
            {r.user.fullName} <span className="text-gray-400 text-xs">@{r.user.username}</span>
          </span>
        ) : (
          <span className="text-gray-400">نظام</span>
        ),
    },
    {
      key: 'ip',
      header: 'IP',
      render: (r) => <span className="font-mono text-xs text-gray-400">{r.ipAddress ?? '—'}</span>,
    },
    {
      key: 'date',
      header: 'التوقيت',
      render: (r) => (
        <span className="text-xs">{new Date(r.createdAt).toLocaleString('ar-SA')}</span>
      ),
    },
  ];

  return (
    <AppShell title="سجل المراجعة">
      <PageHeader title="سجل المراجعة" description={`${data?.meta.total ?? 0} سجل`} />
      <Card className="mt-4">
        <div className="mb-4">
          <Input
            placeholder="تصفية بالكيان (مثل: Customer, Sale)…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <DataTable
          rows={data?.items ?? []}
          columns={columns}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="لا توجد سجلات مراجعة"
        />
        {data && data.meta.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button
              type="button"
              className="btn-ghost text-sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              السابق
            </button>
            <span className="text-sm text-gray-500">
              صفحة {page} من {data.meta.totalPages}
            </span>
            <button
              type="button"
              className="btn-ghost text-sm"
              disabled={page === data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              التالي
            </button>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
