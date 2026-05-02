import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { apiGet, apiPost } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, CheckCheck } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  readAt?: string | null;
  sentAt: string;
}
interface ListResult {
  items: Notification[];
  meta: { total: number; unread: number; totalPages: number; page: number };
}

const TYPE_LABELS: Record<
  string,
  { label: string; variant: 'warning' | 'danger' | 'neutral' | 'success' }
> = {
  CREDIT_LIMIT_EXCEEDED: { label: 'تجاوز حد الائتمان', variant: 'danger' },
  GRACE_PERIOD_ENDING: { label: 'انتهاء المهلة', variant: 'warning' },
  CUSTOMER_INACTIVE: { label: 'عميل غير نشط', variant: 'neutral' },
  CUSTOMER_DEBT_HIGH: { label: 'دَين مرتفع', variant: 'danger' },
};

export function NotificationsPage(): JSX.Element {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiGet<ListResult>('/api/v1/notifications?page=1&limit=50'),
  });

  const markAllMutation = useMutation({
    mutationFn: () => apiPost('/api/v1/notifications/read-all', {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/api/v1/notifications/${id}/read`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = data?.meta.unread ?? 0;

  const columns: Column<Notification>[] = [
    {
      key: 'status',
      header: '',
      render: (r) =>
        !r.readAt ? (
          <Bell className="h-4 w-4 text-primary" />
        ) : (
          <BellOff className="h-4 w-4 text-gray-300" />
        ),
    },
    {
      key: 'type',
      header: 'النوع',
      render: (r) => {
        const t = TYPE_LABELS[r.type] ?? { label: r.type, variant: 'neutral' as const };
        return <Badge variant={t.variant}>{t.label}</Badge>;
      },
    },
    {
      key: 'title',
      header: 'العنوان',
      render: (r) => (
        <span className={!r.readAt ? 'font-semibold text-ink' : 'text-gray-500'}>{r.title}</span>
      ),
    },
    {
      key: 'body',
      header: 'التفاصيل',
      render: (r) => <span className="text-sm text-gray-500 line-clamp-1">{r.body}</span>,
    },
    {
      key: 'date',
      header: 'الوقت',
      render: (r) => (
        <span className="text-xs text-gray-400">{new Date(r.sentAt).toLocaleString('ar-SA')}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) =>
        !r.readAt ? (
          <button
            type="button"
            className="btn-ghost text-xs py-1 px-2"
            onClick={() => markOneMutation.mutate(r.id)}
          >
            تحديد كمقروء
          </button>
        ) : null,
    },
  ];

  return (
    <AppShell title="الإشعارات">
      <PageHeader
        title="الإشعارات"
        description={unread > 0 ? `${unread} إشعار غير مقروء` : 'جميع الإشعارات مقروءة'}
        actions={
          unread > 0 ? (
            <button
              type="button"
              className="btn-ghost flex items-center gap-2"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
            >
              <CheckCheck className="h-4 w-4" /> تحديد الكل كمقروء
            </button>
          ) : undefined
        }
      />
      <Card className="mt-4">
        <DataTable
          rows={data?.items ?? []}
          columns={columns}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="لا توجد إشعارات"
        />
      </Card>
    </AppShell>
  );
}
