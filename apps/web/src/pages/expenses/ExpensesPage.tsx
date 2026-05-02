import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { apiGet } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CreateExpenseModal } from './CreateExpenseModal';

interface Expense {
  id: string;
  amount: number;
  type: string;
  status: string;
  expenseDate: string;
  description?: string;
  category?: { name: string } | null;
  createdBy: { fullName: string };
}
interface ListResult {
  items: Expense[];
  meta: { total: number; totalPages: number; page: number };
}
interface TodayStats {
  total: number;
  count: number;
}

export function ExpensesPage(): JSX.Element {
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['expenses', page],
    queryFn: () => apiGet<ListResult>(`/api/v1/expenses?page=${page}&limit=20`),
  });
  const { data: todayStats } = useQuery({
    queryKey: ['expenses-today'],
    queryFn: () => apiGet<TodayStats>('/api/v1/expenses/stats/today'),
  });

  const columns: Column<Expense>[] = [
    { key: 'cat', header: 'التصنيف', render: (r) => r.category?.name ?? '—' },
    { key: 'desc', header: 'الوصف', render: (r) => r.description ?? '—' },
    {
      key: 'amount',
      header: 'المبلغ',
      numeric: true,
      render: (r) => `${r.amount.toLocaleString('ar-SA')} ر.س`,
    },
    {
      key: 'type',
      header: 'النوع',
      render: (r) => (
        <Badge variant={r.type === 'FIXED' ? 'primary' : 'neutral'}>
          {r.type === 'FIXED' ? 'ثابت' : 'متغير'}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (r) => (
        <Badge variant={r.status === 'ACTIVE' ? 'success' : 'danger'}>
          {r.status === 'ACTIVE' ? 'نشط' : 'ملغي'}
        </Badge>
      ),
    },
    {
      key: 'date',
      header: 'التاريخ',
      render: (r) => new Date(r.expenseDate).toLocaleDateString('ar-SA'),
    },
  ];

  return (
    <AppShell title="المصاريف">
      <PageHeader
        title="المصاريف"
        description={`${data?.meta.total ?? 0} سجل`}
        actions={
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" /> مصروف جديد
          </button>
        }
      />
      {todayStats && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Card>
            <p className="text-xs text-gray-500">مصاريف اليوم</p>
            <p className="text-2xl font-bold text-ink mt-1">
              {todayStats.total.toLocaleString('ar-SA')}{' '}
              <span className="text-sm font-normal text-gray-500">ر.س</span>
            </p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">عدد السجلات اليوم</p>
            <p className="text-2xl font-bold text-ink mt-1">{todayStats.count}</p>
          </Card>
        </div>
      )}
      <Card className="mt-4">
        <DataTable
          rows={data?.items ?? []}
          columns={columns}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="لا توجد مصاريف"
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
      <CreateExpenseModal open={showCreate} onClose={() => setShowCreate(false)} />
    </AppShell>
  );
}
