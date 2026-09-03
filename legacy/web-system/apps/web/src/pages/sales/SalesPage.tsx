import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { apiGet } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CreateSaleModal } from './CreateSaleModal';

interface Sale {
  id: string;
  invoiceNumber: string;
  paymentType: string;
  netAmount: number;
  cancelledAt?: string | null;
  createdAt: string;
  customer?: { name: string } | null;
  createdBy: { fullName: string };
}
interface ListResult {
  items: Sale[];
  meta: { total: number; totalPages: number; page: number };
}

const modeLabel: Record<string, string> = { CASH: 'نقدي', CREDIT: 'آجل' };

export function SalesPage(): JSX.Element {
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['sales', page],
    queryFn: () => apiGet<ListResult>(`/api/v1/sales?page=${page}&limit=20`),
  });

  const columns: Column<Sale>[] = [
    {
      key: 'inv',
      header: 'رقم الفاتورة',
      render: (r) =>
        r.invoiceNumber ? (
          <span className="font-mono text-sm">{r.invoiceNumber}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'customer',
      header: 'العميل',
      render: (r) => r.customer?.name ?? <span className="text-gray-400">نقدي</span>,
    },
    {
      key: 'paymentType',
      header: 'نوع الدفع',
      render: (r) => (
        <Badge variant={r.paymentType === 'CASH' ? 'success' : 'warning'}>
          {modeLabel[r.paymentType] ?? r.paymentType}
        </Badge>
      ),
    },
    {
      key: 'total',
      header: 'الإجمالي',
      numeric: true,
      render: (r) => `${Number(r.netAmount).toLocaleString('en-US')} ر.س`,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (r) => (
        <Badge variant={!r.cancelledAt ? 'success' : 'danger'}>
          {!r.cancelledAt ? 'نشط' : 'ملغي'}
        </Badge>
      ),
    },
    {
      key: 'date',
      header: 'التاريخ',
      render: (r) => new Date(r.createdAt).toLocaleDateString('en-CA'),
    },
  ];

  return (
    <AppShell title="المبيعات">
      <PageHeader
        title="المبيعات"
        description={`${data?.meta.total ?? 0} فاتورة`}
        actions={
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" /> بيع جديد
          </button>
        }
      />
      <Card className="mt-4">
        <DataTable
          rows={data?.items ?? []}
          columns={columns}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="لا توجد مبيعات"
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
      <CreateSaleModal open={showCreate} onClose={() => setShowCreate(false)} />
    </AppShell>
  );
}
