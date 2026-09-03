import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiGet, apiPost } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface Product {
  id: string;
  name: string;
  currentQuantity: number;
  unit: string;
}
interface Props {
  open: boolean;
  onClose: () => void;
  defaultProductId?: string;
}

const TYPES = [
  { value: 'IN', label: 'إدخال' },
  { value: 'OUT', label: 'إخراج' },
  { value: 'ADJUSTMENT', label: 'تسوية' },
  { value: 'RETURN', label: 'مرتجع' },
  { value: 'LOSS', label: 'هالك/تلف' },
];

export function AddStockMovementModal({
  open,
  onClose,
  defaultProductId = '',
}: Props): JSX.Element {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    productId: defaultProductId,
    type: 'IN',
    quantity: '',
    reason: '',
  });
  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const { data: products } = useQuery({
    queryKey: ['products-list-simple'],
    queryFn: () => apiGet<{ items: Product[] }>('/api/v1/products?limit=300&status=ACTIVE'),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiPost('/api/v1/inventory/movements', {
        productId: form.productId,
        type: form.type,
        quantity: Number(form.quantity),
        reason: form.reason || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      setForm({ productId: defaultProductId, type: 'IN', quantity: '', reason: '' });
      onClose();
    },
  });

  const selected = products?.items.find((p) => p.id === form.productId);

  return (
    <Modal open={open} onClose={onClose} title="تسجيل حركة مخزون" size="md">
      <div className="space-y-4">
        <div>
          <label htmlFor="mvProduct" className="label-sm">
            المنتج *
          </label>
          <select
            id="mvProduct"
            value={form.productId}
            onChange={set('productId')}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">اختر المنتج…</option>
            {products?.items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (رصيد: {p.currentQuantity} {p.unit})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="mvType" className="label-sm">
              نوع الحركة *
            </label>
            <select
              id="mvType"
              value={form.type}
              onChange={set('type')}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mvQty" className="label-sm">
              الكمية *
            </label>
            <Input
              id="mvQty"
              type="number"
              value={form.quantity}
              onChange={set('quantity')}
              placeholder={selected ? `وحدة: ${selected.unit}` : '0'}
            />
          </div>
        </div>
        <div>
          <label htmlFor="mvReason" className="label-sm">
            السبب / الملاحظة
          </label>
          <Input
            id="mvReason"
            value={form.reason}
            onChange={set('reason')}
            placeholder="سبب الحركة (اختياري)"
          />
        </div>
        {mutation.isError && <p className="text-sm text-red-500">حدث خطأ، تحقق من البيانات.</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!form.productId || !form.quantity || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'جاري الحفظ…' : 'تسجيل الحركة'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
