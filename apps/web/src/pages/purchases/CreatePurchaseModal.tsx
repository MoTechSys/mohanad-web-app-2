import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiGet, apiPost } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface Supplier {
  id: string;
  name: string;
}
interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreatePurchaseModal({ open, onClose }: Props): JSX.Element {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    paymentType: 'CASH',
    supplierId: '',
    supplierNameManual: '',
    totalAmount: '',
    detailsText: '',
    invoiceNumber: '',
  });
  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list-simple'],
    queryFn: () => apiGet<{ items: Supplier[] }>('/api/v1/suppliers?limit=200'),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiPost('/api/v1/purchases', {
        purchaseMode: 'TOTAL_ONLY',
        paymentType: form.paymentType,
        supplierId: form.supplierId || undefined,
        supplierNameManual: !form.supplierId ? form.supplierNameManual || undefined : undefined,
        totalAmount: Number(form.totalAmount),
        detailsText: form.detailsText || undefined,
        invoiceNumber: form.invoiceNumber || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['purchases'] });
      setForm({
        paymentType: 'CASH',
        supplierId: '',
        supplierNameManual: '',
        totalAmount: '',
        detailsText: '',
        invoiceNumber: '',
      });
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="تسجيل فاتورة مشتريات" size="md">
      <div className="space-y-4">
        <div>
          <label htmlFor="purSupplier" className="label-sm">
            المورد
          </label>
          <select
            id="purSupplier"
            value={form.supplierId}
            onChange={set('supplierId')}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">مورد يدوي</option>
            {suppliers?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {!form.supplierId && (
          <div>
            <label htmlFor="purSupManual" className="label-sm">
              اسم المورد (يدوي)
            </label>
            <Input
              id="purSupManual"
              value={form.supplierNameManual}
              onChange={set('supplierNameManual')}
              placeholder="اسم المورد…"
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="purPayType" className="label-sm">
              طريقة الدفع *
            </label>
            <select
              id="purPayType"
              value={form.paymentType}
              onChange={set('paymentType')}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="CASH">نقدي</option>
              <option value="CREDIT">آجل</option>
            </select>
          </div>
          <div>
            <label htmlFor="purTotal" className="label-sm">
              المبلغ (ر.س) *
            </label>
            <Input
              id="purTotal"
              type="number"
              value={form.totalAmount}
              onChange={set('totalAmount')}
              placeholder="0.00"
            />
          </div>
        </div>
        <div>
          <label htmlFor="purInvoice" className="label-sm">
            رقم الفاتورة
          </label>
          <Input
            id="purInvoice"
            value={form.invoiceNumber}
            onChange={set('invoiceNumber')}
            placeholder="INV-001 (اختياري)"
          />
        </div>
        <div>
          <label htmlFor="purDetails" className="label-sm">
            البيانات
          </label>
          <Input
            id="purDetails"
            value={form.detailsText}
            onChange={set('detailsText')}
            placeholder="تفاصيل الفاتورة…"
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
            disabled={!form.totalAmount || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'جاري الحفظ…' : 'حفظ الفاتورة'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
