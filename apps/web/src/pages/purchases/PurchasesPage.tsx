import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { apiGet } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';

interface Purchase {
  id: string;
  invoiceNumber?: string;
  mode: string;
  paymentType: string;
  totalAmount: number;
  status: string;
  purchaseDate: string;
  supplier: { name: string };
}
interface ListResult {
  items: Purchase[];
  meta: { total: number; totalPages: number; page: number };
}

export function PurchasesPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['purchases', page],
    queryFn: () => apiGet<ListResult>(`/api/v1/purchases?page=${page}&limit=20`),
  });

  const columns: Column<Purchase>[] = [
    { key: 'supplier', header: 'المورد', render: (r) => r.supplier.name },
    { key: 'inv', header: 'رقم الفاتورة', render: (r) => r.invoiceNumber ?? '—' },
    {
      key: 'payment',
      header: 'الدفع',
      render: (r) => (
        <Badge variant={r.paymentType === 'CASH' ? 'success' : 'warning'}>
          {r.paymentType === 'CASH' ? 'نقدي' : 'آجل'}
        </Badge>
      ),
    },
    {
      key: 'total',
      header: 'الإجمالي',
      numeric: true,
      render: (r) => `${r.totalAmount.toLocaleString('ar-SA')} ر.س`,
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
      render: (r) => new Date(r.purchaseDate).toLocaleDateString('ar-SA'),
    },
  ];

  return (
    <AppShell title="المشتريات">
      <PageHeader
        title="المشتريات"
        description={`${data?.meta.total ?? 0} فاتورة`}
        actions={
          <button type="button" className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> مشتريات جديدة
          </button>
        }
      />
      <Card className="mt-4">
        <DataTable
          rows={data?.items ?? []}
          columns={columns}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="لا توجد مشتريات"
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
