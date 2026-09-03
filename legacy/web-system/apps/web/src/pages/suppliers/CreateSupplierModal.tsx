import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiPost } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateSupplierModal({ open, onClose }: Props): JSX.Element {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    openingBalance: '',
  });
  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () =>
      apiPost('/api/v1/suppliers', {
        name: form.name,
        phone: form.phone || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
        openingBalance: form.openingBalance ? Number(form.openingBalance) : 0,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      setForm({ name: '', phone: '', address: '', notes: '', openingBalance: '' });
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="إضافة مورد جديد" size="md">
      <div className="space-y-4">
        <div>
          <label htmlFor="supName" className="label-sm">
            اسم المورد *
          </label>
          <Input
            id="supName"
            value={form.name}
            onChange={set('name')}
            placeholder="اسم المورد أو الشركة"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="supPhone" className="label-sm">
              رقم الجوال
            </label>
            <Input
              id="supPhone"
              value={form.phone}
              onChange={set('phone')}
              placeholder="05XXXXXXXX"
            />
          </div>
          <div>
            <label htmlFor="supOpening" className="label-sm">
              رصيد افتتاحي (ر.س)
            </label>
            <Input
              id="supOpening"
              type="number"
              value={form.openingBalance}
              onChange={set('openingBalance')}
              placeholder="0"
            />
          </div>
        </div>
        <div>
          <label htmlFor="supAddress" className="label-sm">
            العنوان
          </label>
          <Input
            id="supAddress"
            value={form.address}
            onChange={set('address')}
            placeholder="العنوان (اختياري)"
          />
        </div>
        <div>
          <label htmlFor="supNotes" className="label-sm">
            ملاحظات
          </label>
          <Input
            id="supNotes"
            value={form.notes}
            onChange={set('notes')}
            placeholder="ملاحظات (اختياري)"
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
            {mutation.isPending ? 'جاري الحفظ…' : 'حفظ المورد'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
