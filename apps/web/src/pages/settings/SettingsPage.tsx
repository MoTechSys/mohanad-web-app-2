import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { apiGet, apiPut } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';

interface StoreInfo {
  storeName?: string;
  ownerName?: string;
  phone?: string;
  address?: string;
  currency?: string;
}
interface AllSettings {
  store_info?: StoreInfo;
  whatsapp?: { enabled?: boolean; senderPhone?: string };
}

export function SettingsPage(): JSX.Element {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiGet<AllSettings>('/api/v1/settings'),
  });

  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('SAR');

  useEffect(() => {
    if (settings?.store_info) {
      setStoreName(settings.store_info.storeName ?? '');
      setOwnerName(settings.store_info.ownerName ?? '');
      setPhone(settings.store_info.phone ?? '');
      setAddress(settings.store_info.address ?? '');
      setCurrency(settings.store_info.currency ?? 'SAR');
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPut('/api/v1/settings', {
        key: 'store_info',
        value: { storeName, ownerName, phone, address, currency },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return (
    <AppShell title="الإعدادات">
      <PageHeader
        title="الإعدادات"
        description="إعدادات المتجر والنظام"
        actions={<Settings className="h-5 w-5 text-gray-400" />}
      />

      <Card className="mt-4" header="معلومات المتجر">
        {isLoading ? (
          <div className="h-40 animate-pulse bg-gray-100 rounded-lg" />
        ) : (
          <div className="space-y-4">
            <div className="grid desktop:grid-cols-2 gap-4">
              <div>
                <label htmlFor="storeName" className="block text-sm font-medium text-gray-700 mb-1">
                  اسم المتجر
                </label>
                <Input
                  id="storeName"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="بقالة محمد"
                />
              </div>
              <div>
                <label htmlFor="ownerName" className="block text-sm font-medium text-gray-700 mb-1">
                  اسم المالك
                </label>
                <Input
                  id="ownerName"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="محمد العبدالله"
                />
              </div>
              <div>
                <label
                  htmlFor="storePhone"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  رقم الجوال
                </label>
                <Input
                  id="storePhone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                />
              </div>
              <div>
                <label
                  htmlFor="storeCurrency"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  العملة
                </label>
                <Input
                  id="storeCurrency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="SAR"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="storeAddress"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                العنوان
              </label>
              <Input
                id="storeAddress"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="المدينة - الحي"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-primary flex items-center gap-2"
                disabled={saveMutation.isPending}
                onClick={() => {
                  saveMutation.mutate();
                }}
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? 'جاري الحفظ…' : 'حفظ التغييرات'}
              </button>
            </div>
            {saveMutation.isSuccess && (
              <p className="text-sm text-green-600 text-center">✓ تم حفظ الإعدادات بنجاح</p>
            )}
          </div>
        )}
      </Card>

      <Card className="mt-4" header="الإعدادات المتقدمة">
        <p className="text-sm text-gray-500">
          إعدادات WhatsApp وإشعارات التذكير ستكون متاحة قريباً.
        </p>
      </Card>
    </AppShell>
  );
}
