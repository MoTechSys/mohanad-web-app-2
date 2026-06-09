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
import { CreateProductModal } from './CreateProductModal';

interface Product {
  id: string;
  name: string;
  barcode?: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  currentQuantity: number;
  minQuantity: number;
  status: string;
  trackInventory: boolean;
}
interface ListResult {
  items: Product[];
  meta: { total: number; totalPages: number; page: number };
}

export function ProductsPage(): JSX.Element {
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search],
    queryFn: () =>
      apiGet<ListResult>(
        `/api/v1/products?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  const columns: Column<Product>[] = [
    { key: 'name', header: 'المنتج', render: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: 'barcode',
      header: 'الباركود',
      render: (r) => <span className="font-mono text-xs text-gray-500">{r.barcode ?? '—'}</span>,
    },
    { key: 'unit', header: 'الوحدة', render: (r) => r.unit },
    {
      key: 'buy',
      header: 'سعر الشراء',
      numeric: true,
      render: (r) => `${Number(r.purchasePrice).toLocaleString('en-US')} ر.س`,
    },
    {
      key: 'sell',
      header: 'سعر البيع',
      numeric: true,
      render: (r) => `${Number(r.salePrice).toLocaleString('en-US')} ر.س`,
    },
    {
      key: 'qty',
      header: 'المخزون',
      numeric: true,
      render: (r) =>
        r.trackInventory ? (
          <Badge
            variant={Number(r.currentQuantity) <= Number(r.minQuantity) ? 'warning' : 'success'}
          >
            {Number(r.currentQuantity).toLocaleString('en-US')}
          </Badge>
        ) : (
          <span className="text-gray-400 text-xs">لا يُتابع</span>
        ),
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
    <AppShell title="المنتجات">
      <PageHeader
        title="المنتجات"
        description={`${data?.meta.total ?? 0} منتج`}
        actions={
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" /> منتج جديد
          </button>
        }
      />
      <Card className="mt-4">
        <div className="mb-4">
          <Input
            placeholder="بحث بالاسم أو الباركود…"
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
          emptyTitle="لا توجد منتجات"
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
      <CreateProductModal open={showCreate} onClose={() => setShowCreate(false)} />
    </AppShell>
  );
}
