import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { apiGet } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, Package } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  unit: string;
  currentQuantity: number;
  minQuantity: number;
  salePrice: number;
}
interface Stats {
  total: number;
  active: number;
  lowStock: number;
  outOfStock: number;
}

export function InventoryPage(): JSX.Element {
  const { data: stats } = useQuery({
    queryKey: ['inv-stats'],
    queryFn: () => apiGet<Stats>('/api/v1/inventory/stats'),
  });
  const { data: lowStock, isLoading } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => apiGet<Product[]>('/api/v1/inventory/low-stock'),
  });

  const columns: Column<Product>[] = [
    { key: 'name', header: 'المنتج', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'unit', header: 'الوحدة', render: (r) => r.unit },
    {
      key: 'qty',
      header: 'الكمية',
      numeric: true,
      render: (r) => (
        <Badge variant={r.currentQuantity <= 0 ? 'danger' : 'warning'}>
          {Number(r.currentQuantity).toLocaleString('ar-SA')}
        </Badge>
      ),
    },
    {
      key: 'min',
      header: 'الحد الأدنى',
      numeric: true,
      render: (r) => Number(r.minQuantity).toLocaleString('ar-SA'),
    },
    {
      key: 'price',
      header: 'سعر البيع',
      numeric: true,
      render: (r) => `${Number(r.salePrice).toLocaleString('ar-SA')} ر.س`,
    },
  ];

  return (
    <AppShell title="المخزون">
      <PageHeader title="المخزون" description="إدارة ومراقبة مستويات المخزون" />
      <div className="mt-4 grid grid-cols-2 desktop:grid-cols-4 gap-4">
        {[
          {
            label: 'إجمالي المنتجات',
            value: stats?.total ?? 0,
            icon: Boxes,
            color: 'text-blue-600',
          },
          {
            label: 'منتجات نشطة',
            value: stats?.active ?? 0,
            icon: Package,
            color: 'text-green-600',
          },
          {
            label: 'قرب النفاد',
            value: stats?.lowStock ?? 0,
            icon: AlertTriangle,
            color: 'text-amber-600',
          },
          {
            label: 'نفد المخزون',
            value: stats?.outOfStock ?? 0,
            icon: AlertTriangle,
            color: 'text-red-600',
          },
        ].map((s) => (
          <Card key={s.label}>
            <div className="flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-ink">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card
        className="mt-6"
        header={
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            منتجات قرب النفاد
          </span>
        }
      >
        <DataTable
          rows={lowStock ?? []}
          columns={columns}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="جميع المنتجات لديها مخزون كافٍ"
        />
      </Card>
    </AppShell>
  );
}
