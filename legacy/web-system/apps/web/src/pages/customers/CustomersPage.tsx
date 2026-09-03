import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { apiGet } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CreateCustomerModal } from './CreateCustomerModal';
import { CustomerPaymentModal } from './CustomerPaymentModal';

interface Customer {
  id: string;
  name: string;
  phone?: string;
  currentBalance: number | null;
  creditLimit: number | null;
  status: string;
  createdAt: string;
}
interface ListResult {
  items: Customer[];
  meta: { total: number; totalPages: number; page: number };
}

export function CustomersPage(): JSX.Element {
  const [showCreate, setShowCreate] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search],
    queryFn: () =>
      apiGet<ListResult>(
        `/api/v1/customers?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'الاسم',
      render: (r) => (
        <Link
          to={`/customers/${r.id}`}
          className="font-medium text-ink hover:text-primary hover:underline"
        >
          {r.name}
        </Link>
      ),
    },
    { key: 'phone', header: 'الجوال', render: (r) => r.phone ?? '—' },
    {
      key: 'balance',
      header: 'الرصيد',
      numeric: true,
      render: (r) => (
        <Badge variant={(r.currentBalance ?? 0) > 0 ? 'debt' : 'success'}>
          {Math.abs(r.currentBalance ?? 0).toLocaleString('en-US')} ر.س
        </Badge>
      ),
    },
    {
      key: 'creditLimit',
      header: 'حد الائتمان',
      numeric: true,
      render: (r) => (r.creditLimit ?? 0).toLocaleString('en-US'),
    },
    {
      key: 'pay',
      header: '',
      render: (r) =>
        r.status === 'ACTIVE' && Number(r.currentBalance) > 0 ? (
          <button
            type="button"
            className="btn-ghost text-xs py-1 px-2"
            onClick={() => setPaymentTarget({ id: r.id, name: r.name })}
          >
            تسديد
          </button>
        ) : null,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (r) => (
        <Badge variant={r.status === 'ACTIVE' ? 'success' : 'neutral'}>
          {r.status === 'ACTIVE' ? 'نشط' : 'موقوف'}
        </Badge>
      ),
    },
  ];

  return (
    <AppShell title="العملاء">
      <PageHeader
        title="العملاء"
        description={`${data?.meta.total ?? 0} عميل`}
        actions={
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowCreate(true)}
          >
            <UserPlus className="h-4 w-4" /> عميل جديد
          </button>
        }
      />
      <Card className="mt-4">
        <div className="mb-4">
          <Input
            placeholder="بحث بالاسم أو الجوال…"
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
          emptyTitle="لا يوجد عملاء"
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
      <CreateCustomerModal open={showCreate} onClose={() => setShowCreate(false)} />
      <CustomerPaymentModal
        open={paymentTarget !== null}
        onClose={() => setPaymentTarget(null)}
        customerId={paymentTarget?.id ?? ''}
        customerName={paymentTarget?.name ?? ''}
      />
    </AppShell>
  );
}
