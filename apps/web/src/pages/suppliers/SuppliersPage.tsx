import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { apiGet } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CreateSupplierModal } from './CreateSupplierModal';
import { SupplierPaymentModal } from './SupplierPaymentModal';

interface Supplier {
  id: string;
  name: string;
  phone?: string;
  currentBalance: number;
}
interface ListResult {
  items: Supplier[];
  meta: { total: number; totalPages: number; page: number };
}

export function SuppliersPage(): JSX.Element {
  const [showCreate, setShowCreate] = useState(false);
  const [payTarget, setPayTarget] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page, search],
    queryFn: () =>
      apiGet<ListResult>(
        `/api/v1/suppliers?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'الاسم',
      render: (r) => (
        <Link to={`/suppliers/${r.id}`} className="font-medium hover:text-primary hover:underline">
          {r.name}
        </Link>
      ),
    },
    { key: 'phone', header: 'الجوال', render: (r) => r.phone ?? '—' },
    {
      key: 'balance',
      header: 'المديونية',
      numeric: true,
      render: (r) => (
        <Badge variant={(r.currentBalance ?? 0) > 0 ? 'warning' : 'success'}>
          {Math.abs(r.currentBalance ?? 0).toLocaleString('ar-SA')} ر.س
        </Badge>
      ),
    },
  ];

  return (
    <AppShell title="الموردون">
      <PageHeader
        title="الموردون"
        description={`${data?.meta.total ?? 0} مورد`}
        actions={
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" /> مورد جديد
          </button>
        }
      />
      <Card className="mt-4">
        <div className="mb-4">
          <Input
            placeholder="بحث باسم المورد…"
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
          emptyTitle="لا يوجد موردون"
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
      <CreateSupplierModal open={showCreate} onClose={() => setShowCreate(false)} />
      <SupplierPaymentModal
        open={payTarget !== null}
        onClose={() => setPayTarget(null)}
        supplierId={payTarget?.id ?? ''}
        supplierName={payTarget?.name ?? ''}
      />
    </AppShell>
  );
}
