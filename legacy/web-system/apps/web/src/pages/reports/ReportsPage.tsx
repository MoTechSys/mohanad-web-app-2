import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { apiGet } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react';

interface Dashboard {
  today: {
    sales: { total: number; count: number };
    expenses: { total: number; count: number };
    income: { total: number; count: number };
    net: number;
  };
  outstanding: {
    customersDebt: { total: number; count: number };
    suppliersDebt: { total: number; count: number };
  };
}
interface Debtor {
  id: string;
  name: string;
  phone?: string;
  currentBalance: number;
}

export function ReportsPage(): JSX.Element {
  const { data: dash, isLoading } = useQuery({
    queryKey: ['dashboard-report'],
    queryFn: () => apiGet<Dashboard>('/api/v1/reports/dashboard'),
  });
  const { data: debtors } = useQuery({
    queryKey: ['top-debtors'],
    queryFn: () => apiGet<Debtor[]>('/api/v1/reports/top-debtors?limit=10'),
  });

  const debtorCols: Column<Debtor>[] = [
    { key: 'name', header: 'العميل', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'phone', header: 'الجوال', render: (r) => r.phone ?? '—' },
    {
      key: 'balance',
      header: 'المديونية',
      numeric: true,
      render: (r) => (
        <Badge variant="debt">{Math.abs(r.currentBalance ?? 0).toLocaleString('en-US')} ر.س</Badge>
      ),
    },
  ];

  const net = dash?.today.net ?? 0;

  return (
    <AppShell title="التقارير">
      <PageHeader title="التقارير والإحصائيات" description="ملخص اليوم والمؤشرات المالية" />
      <div className="mt-4 grid grid-cols-2 desktop:grid-cols-4 gap-4">
        {[
          {
            label: 'مبيعات اليوم',
            value: dash?.today.sales.total ?? 0,
            icon: TrendingUp,
            color: 'text-green-600',
            count: dash?.today.sales.count,
          },
          {
            label: 'مصاريف اليوم',
            value: dash?.today.expenses.total ?? 0,
            icon: TrendingDown,
            color: 'text-red-500',
            count: dash?.today.expenses.count,
          },
          {
            label: 'إيرادات أخرى',
            value: dash?.today.income.total ?? 0,
            icon: Wallet,
            color: 'text-blue-600',
            count: dash?.today.income.count,
          },
          {
            label: 'صافي اليوم',
            value: net,
            icon: BarChart3,
            color: net >= 0 ? 'text-green-700' : 'text-red-600',
            count: undefined,
          },
        ].map((s) => (
          <Card key={s.label}>
            <div className="flex items-start gap-3">
              <s.icon className={`h-7 w-7 mt-1 ${s.color}`} />
              <div className="flex-1">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>
                  {Math.abs(s.value).toLocaleString('en-US')}{' '}
                  <span className="text-xs font-normal text-gray-400">ر.س</span>
                </p>
                {s.count !== undefined && <p className="text-xs text-gray-400">{s.count} سجل</p>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid desktop:grid-cols-2 gap-6">
        <Card
          header={
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-red-500" />
              الديون المستحقة
            </span>
          }
        >
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">ديون العملاء</span>
              <Badge variant="debt">
                {(dash?.outstanding.customersDebt.total ?? 0).toLocaleString('en-US')} ر.س
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">ديون الموردين</span>
              <Badge variant="warning">
                {(dash?.outstanding.suppliersDebt.total ?? 0).toLocaleString('en-US')} ر.س
              </Badge>
            </div>
          </div>
        </Card>

        <Card header="أعلى العملاء مديونية">
          <DataTable
            rows={debtors ?? []}
            columns={debtorCols}
            isLoading={isLoading}
            rowKey={(r) => r.id}
            emptyTitle="لا توجد ديون مستحقة"
          />
        </Card>
      </div>
    </AppShell>
  );
}
