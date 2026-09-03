import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiGet, apiPost } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface Customer {
  id: string;
  name: string;
  currentBalance: number;
}
interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateSaleModal({ open, onClose }: Props): JSX.Element {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    paymentType: 'CASH',
    customerId: '',
    totalAmount: '',
    detailsText: '',
    invoiceNumber: '',
  });
  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const { data: customers } = useQuery({
    queryKey: ['customers-list-simple'],
    queryFn: () => apiGet<{ items: Customer[] }>('/api/v1/customers?limit=200'),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiPost('/api/v1/sales', {
        saleMode: 'TOTAL_ONLY',
        paymentType: form.paymentType,
        customerId: form.customerId || undefined,
        totalAmount: Number(form.totalAmount),
        detailsText: form.detailsText || undefined,
        invoiceNumber: form.invoiceNumber || undefined,
        discountAmount: 0,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sales'] });
      setForm({
        paymentType: 'CASH',
        customerId: '',
        totalAmount: '',
        detailsText: '',
        invoiceNumber: '',
      });
      onClose();
    },
  });

  const isCredit = form.paymentType === 'CREDIT';

  return (
    <Modal open={open} onClose={onClose} title="تسجيل عملية بيع" size="md">
      <div className="space-y-4">
        <div>
          <label htmlFor="salePayType" className="label-sm">
            طريقة الدفع *
          </label>
          <select
            id="salePayType"
            value={form.paymentType}
            onChange={set('paymentType')}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="CASH">نقدي</option>
            <option value="CREDIT">آجل</option>
          </select>
        </div>
        {isCredit && (
          <div>
            <label htmlFor="saleCustomer" className="label-sm">
              العميل *
            </label>
            <select
              id="saleCustomer"
              value={form.customerId}
              onChange={set('customerId')}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">اختر العميل…</option>
              {customers?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="saleTotalAmt" className="label-sm">
            المبلغ الإجمالي (ر.س) *
          </label>
          <Input
            id="saleTotalAmt"
            type="number"
            value={form.totalAmount}
            onChange={set('totalAmount')}
            placeholder="0.00"
          />
        </div>
        <div>
          <label htmlFor="saleInvoice" className="label-sm">
            رقم الفاتورة
          </label>
          <Input
            id="saleInvoice"
            value={form.invoiceNumber}
            onChange={set('invoiceNumber')}
            placeholder="INV-001 (اختياري)"
          />
        </div>
        <div>
          <label htmlFor="saleDetails" className="label-sm">
            ملاحظات
          </label>
          <Input
            id="saleDetails"
            value={form.detailsText}
            onChange={set('detailsText')}
            placeholder="ملاحظات (اختياري)"
          />
        </div>
        {mutation.isError && (
          <p className="text-sm text-red-500">
            حدث خطأ —{' '}
            {isCredit && !form.customerId ? 'البيع الآجل يتطلب عميلاً.' : 'تحقق من البيانات.'}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!form.totalAmount || (isCredit && !form.customerId) || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'جاري الحفظ…' : 'تسجيل البيع'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
