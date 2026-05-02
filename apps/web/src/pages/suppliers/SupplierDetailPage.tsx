import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { apiGet } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { SupplierPaymentModal } from './SupplierPaymentModal';

interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  currentBalance: number;
  deletedAt?: string | null;
}
interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  notes?: string;
  createdAt: string;
  createdBy: { fullName: string };
}
interface TxList {
  items: Transaction[];
  meta: { total: number; totalPages: number };
}

const TX_LABELS: Record<
  string,
  { label: string; variant: 'success' | 'danger' | 'warning' | 'neutral' }
> = {
  CREDIT_PURCHASE: { label: 'شراء آجل', variant: 'danger' },
  PAYMENT: { label: 'دفع', variant: 'success' },
  ADJUSTMENT: { label: 'تسوية', variant: 'warning' },
  OPENING: { label: 'افتتاحي', variant: 'neutral' },
};

export function SupplierDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [txPage, setTxPage] = useState(1);
  const [showPayment, setShowPayment] = useState(false);

  const { data: supplier, isLoading } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => apiGet<Supplier>(`/api/v1/suppliers/${id}`),
    enabled: !!id,
  });

  const { data: txList, isLoading: txLoading } = useQuery({
    queryKey: ['supplier-transactions', id, txPage],
    queryFn: () => apiGet<TxList>(`/api/v1/suppliers/${id}/transactions?page=${txPage}&limit=20`),
    enabled: !!id,
  });

  const txColumns: Column<Transaction>[] = [
    {
      key: 'type',
      header: 'النوع',
      render: (r) => {
        const t = TX_LABELS[r.type] ?? { label: r.type, variant: 'neutral' as const };
        return <Badge variant={t.variant}>{t.label}</Badge>;
      },
    },
    {
      key: 'amount',
      header: 'المبلغ',
      numeric: true,
      render: (r) => `${r.amount.toLocaleString('ar-SA')} ر.س`,
    },
    {
      key: 'balanceAfter',
      header: 'الرصيد بعده',
      numeric: true,
      render: (r) => (
        <span className={r.balanceAfter > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
          {r.balanceAfter.toLocaleString('ar-SA')} ر.س
        </span>
      ),
    },
    { key: 'notes', header: 'ملاحظات', render: (r) => r.notes ?? '—' },
    { key: 'by', header: 'بواسطة', render: (r) => r.createdBy.fullName },
    {
      key: 'date',
      header: 'التاريخ',
      render: (r) => new Date(r.createdAt).toLocaleDateString('ar-SA'),
    },
  ];

  if (isLoading)
    return (
      <AppShell title="…">
        <div className="p-8 text-center text-gray-400">جاري التحميل…</div>
      </AppShell>
    );
  if (!supplier)
    return (
      <AppShell title="خطأ">
        <div className="p-8 text-center text-red-500">لم يُعثر على المورد.</div>
      </AppShell>
    );

  const isActive = !supplier.deletedAt;

  return (
    <AppShell title={supplier.name}>
      <PageHeader
        title={supplier.name}
        description={supplier.phone ?? ''}
        actions={
          isActive && supplier.currentBalance > 0 ? (
            <button type="button" className="btn-primary" onClick={() => setShowPayment(true)}>
              تسجيل دفع
            </button>
          ) : undefined
        }
      />

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-gray-500">الدَّين المستحق</p>
          <p
            className={`text-2xl font-bold mt-1 ${supplier.currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}
          >
            {supplier.currentBalance.toLocaleString('ar-SA')}{' '}
            <span className="text-sm font-normal text-gray-400">ر.س</span>
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">الحالة</p>
          <div className="mt-2">
            <Badge variant={isActive ? 'success' : 'neutral'}>{isActive ? 'نشط' : 'محذوف'}</Badge>
          </div>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">عدد المعاملات</p>
          <p className="text-2xl font-bold text-ink mt-1">{txList?.meta.total ?? '…'}</p>
        </Card>
      </div>

      {supplier.address && (
        <Card className="mt-4">
          <p className="text-xs text-gray-500 mb-1">العنوان</p>
          <p className="text-sm">{supplier.address}</p>
        </Card>
      )}

      <Card className="mt-4" header="سجل المعاملات">
        <DataTable
          rows={txList?.items ?? []}
          columns={txColumns}
          isLoading={txLoading}
          rowKey={(r) => r.id}
          emptyTitle="لا توجد معاملات"
        />
        {txList && txList.meta.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button
              type="button"
              className="btn-ghost text-sm"
              disabled={txPage === 1}
              onClick={() => setTxPage((p) => p - 1)}
            >
              السابق
            </button>
            <span className="text-sm text-gray-500">
              صفحة {txPage} من {txList.meta.totalPages}
            </span>
            <button
              type="button"
              className="btn-ghost text-sm"
              disabled={txPage === txList.meta.totalPages}
              onClick={() => setTxPage((p) => p + 1)}
            >
              التالي
            </button>
          </div>
        )}
      </Card>

      <SupplierPaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        supplierId={supplier.id}
        supplierName={supplier.name}
      />
    </AppShell>
  );
}
