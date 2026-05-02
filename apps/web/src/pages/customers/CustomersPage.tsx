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

interface Customer {
  id: string;
  name: string;
  phone?: string;
  balance: number;
  creditLimit: number;
  status: string;
  createdAt: string;
}
interface ListResult {
  items: Customer[];
  meta: { total: number; totalPages: number; page: number };
}

export function CustomersPage(): JSX.Element {
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
      render: (r) => <span className="font-medium text-ink">{r.name}</span>,
    },
    { key: 'phone', header: 'الجوال', render: (r) => r.phone ?? '—' },
    {
      key: 'balance',
      header: 'الرصيد',
      numeric: true,
      render: (r) => (
        <Badge variant={r.balance > 0 ? 'debt' : 'success'}>
          {Math.abs(r.balance).toLocaleString('ar-SA')} ر.س
        </Badge>
      ),
    },
    {
      key: 'creditLimit',
      header: 'حد الائتمان',
      numeric: true,
      render: (r) => r.creditLimit.toLocaleString('ar-SA'),
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
          <button type="button" className="btn-primary flex items-center gap-2">
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
    </AppShell>
  );
}
