import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiPost } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateCustomerModal({ open, onClose }: Props): JSX.Element {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    whatsappPhone: '',
    address: '',
    notes: '',
    creditLimit: '',
    openingBalance: '',
  });
  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () =>
      apiPost('/api/v1/customers', {
        name: form.name,
        phone: form.phone || undefined,
        whatsappPhone: form.whatsappPhone || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
        creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
        openingBalance: form.openingBalance ? Number(form.openingBalance) : 0,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customers'] });
      setForm({
        name: '',
        phone: '',
        whatsappPhone: '',
        address: '',
        notes: '',
        creditLimit: '',
        openingBalance: '',
      });
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="إضافة عميل جديد" size="md">
      <div className="space-y-4">
        <div>
          <label htmlFor="custName" className="label-sm">
            الاسم *
          </label>
          <Input id="custName" value={form.name} onChange={set('name')} placeholder="اسم العميل" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="custPhone" className="label-sm">
              رقم الجوال
            </label>
            <Input
              id="custPhone"
              value={form.phone}
              onChange={set('phone')}
              placeholder="05XXXXXXXX"
            />
          </div>
          <div>
            <label htmlFor="custWa" className="label-sm">
              واتساب
            </label>
            <Input
              id="custWa"
              value={form.whatsappPhone}
              onChange={set('whatsappPhone')}
              placeholder="05XXXXXXXX"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="custCredit" className="label-sm">
              حد الائتمان (ر.س)
            </label>
            <Input
              id="custCredit"
              type="number"
              value={form.creditLimit}
              onChange={set('creditLimit')}
              placeholder="0"
            />
          </div>
          <div>
            <label htmlFor="custOpening" className="label-sm">
              رصيد افتتاحي (ر.س)
            </label>
            <Input
              id="custOpening"
              type="number"
              value={form.openingBalance}
              onChange={set('openingBalance')}
              placeholder="0"
            />
          </div>
        </div>
        <div>
          <label htmlFor="custAddress" className="label-sm">
            العنوان
          </label>
          <Input
            id="custAddress"
            value={form.address}
            onChange={set('address')}
            placeholder="العنوان (اختياري)"
          />
        </div>
        {mutation.isError && (
          <p className="text-sm text-red-500">حدث خطأ، تحقق من البيانات وأعد المحاولة.</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!form.name || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'جاري الحفظ…' : 'حفظ العميل'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
