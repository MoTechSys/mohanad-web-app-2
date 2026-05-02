import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiGet, apiPost } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface Category {
  id: string;
  name: string;
}
interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateExpenseModal({ open, onClose }: Props): JSX.Element {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    amount: '',
    detailsText: '',
    categoryId: '',
    expenseDate: '',
  });
  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const { data: categories } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => apiGet<{ items: Category[] }>('/api/v1/expenses/categories'),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiPost('/api/v1/expenses', {
        type: 'NORMAL',
        amount: Number(form.amount),
        categoryId: form.categoryId || undefined,
        detailsText: form.detailsText || undefined,
        expenseDate: form.expenseDate ? new Date(form.expenseDate) : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      setForm({ amount: '', detailsText: '', categoryId: '', expenseDate: '' });
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="تسجيل مصروف جديد" size="md">
      <div className="space-y-4">
        <div>
          <label htmlFor="expAmount" className="label-sm">
            المبلغ (ر.س) *
          </label>
          <Input
            id="expAmount"
            type="number"
            value={form.amount}
            onChange={set('amount')}
            placeholder="0.00"
          />
        </div>
        <div>
          <label htmlFor="expCat" className="label-sm">
            الفئة
          </label>
          <select
            id="expCat"
            value={form.categoryId}
            onChange={set('categoryId')}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">بدون فئة</option>
            {categories?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="expDetails" className="label-sm">
            التفاصيل
          </label>
          <Input
            id="expDetails"
            value={form.detailsText}
            onChange={set('detailsText')}
            placeholder="وصف المصروف…"
          />
        </div>
        <div>
          <label htmlFor="expDate" className="label-sm">
            التاريخ
          </label>
          <Input id="expDate" type="date" value={form.expenseDate} onChange={set('expenseDate')} />
        </div>
        {mutation.isError && <p className="text-sm text-red-500">حدث خطأ، تحقق من البيانات.</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!form.amount || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'جاري الحفظ…' : 'حفظ المصروف'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
