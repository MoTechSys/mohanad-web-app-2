import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { apiGet, apiPost } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';

interface DailyIncome {
  id: string;
  amount: number;
  source: string;
  isApproved: boolean;
  incomeDate: string;
  cancelledAt?: string | null;
  createdBy: { fullName: string };
}
interface ListResult {
  items: DailyIncome[];
  meta: { total: number; totalPages: number; page: number };
}
interface TodayStats {
  count: number;
  total: number;
}

export function DailyIncomePage(): JSX.Element {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['daily-income', page],
    queryFn: () => apiGet<ListResult>(`/api/v1/daily-income?page=${page}&limit=20`),
  });
  const { data: todayStats } = useQuery({
    queryKey: ['daily-income-today'],
    queryFn: () => apiGet<TodayStats>('/api/v1/daily-income/stats/today'),
  });

  const createMutation = useMutation({
    mutationFn: (body: { amount: number; source: string }) => apiPost('/api/v1/daily-income', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['daily-income'] });
      void qc.invalidateQueries({ queryKey: ['daily-income-today'] });
      setAmount('');
      setSource('');
      setShowForm(false);
    },
  });

  const columns: Column<DailyIncome>[] = [
    {
      key: 'source',
      header: 'المصدر',
      render: (r) => <span className="font-medium">{r.source}</span>,
    },
    {
      key: 'amount',
      header: 'المبلغ',
      numeric: true,
      render: (r) => `${r.amount.toLocaleString('ar-SA')} ر.س`,
    },
    {
      key: 'approved',
      header: 'الحالة',
      render: (r) =>
        r.cancelledAt ? (
          <Badge variant="danger">ملغي</Badge>
        ) : (
          <Badge variant={r.isApproved ? 'success' : 'warning'}>
            {r.isApproved ? 'معتمد' : 'بانتظار'}
          </Badge>
        ),
    },
    { key: 'by', header: 'بواسطة', render: (r) => r.createdBy.fullName },
    {
      key: 'date',
      header: 'التاريخ',
      render: (r) => new Date(r.incomeDate).toLocaleDateString('ar-SA'),
    },
  ];

  return (
    <AppShell title="الإيرادات اليومية">
      <PageHeader
        title="الإيرادات اليومية"
        description={`${data?.meta.total ?? 0} سجل`}
        actions={
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus className="h-4 w-4" /> إيراد جديد
          </button>
        }
      />

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs text-gray-500">إيرادات اليوم</p>
          <p className="text-2xl font-bold text-ink mt-1">
            {(todayStats?.total ?? 0).toLocaleString('ar-SA')}{' '}
            <span className="text-sm font-normal text-gray-400">ر.س</span>
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">عدد سجلات اليوم</p>
          <p className="text-2xl font-bold text-ink mt-1">{todayStats?.count ?? 0}</p>
        </Card>
      </div>

      {showForm && (
        <Card className="mt-4" header="تسجيل إيراد جديد">
          <div className="space-y-3">
            <div>
              <label
                htmlFor="incomeAmount"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                المبلغ (ر.س)
              </label>
              <Input
                id="incomeAmount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label
                htmlFor="incomeSource"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                المصدر
              </label>
              <Input
                id="incomeSource"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="مثال: تحصيل ديون، تأجير، ..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
                إلغاء
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!amount || !source || createMutation.isPending}
                onClick={() => {
                  createMutation.mutate({ amount: Number(amount), source });
                }}
              >
                {createMutation.isPending ? 'جاري الحفظ…' : 'حفظ'}
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card className="mt-4">
        <DataTable
          rows={data?.items ?? []}
          columns={columns}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="لا توجد إيرادات مسجلة"
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
