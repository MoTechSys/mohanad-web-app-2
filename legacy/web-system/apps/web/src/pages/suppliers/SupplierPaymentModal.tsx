import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiPost } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  supplierId: string;
  supplierName: string;
}

export function SupplierPaymentModal({
  open,
  onClose,
  supplierId,
  supplierName,
}: Props): JSX.Element {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      apiPost(`/api/v1/suppliers/${supplierId}/transactions/payment`, {
        amount: Number(amount),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      setAmount('');
      setNotes('');
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={`دفع للمورد — ${supplierName}`} size="sm">
      <div className="space-y-4">
        <div>
          <label htmlFor="supPayAmount" className="label-sm">
            المبلغ (ر.س) *
          </label>
          <Input
            id="supPayAmount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <label htmlFor="supPayNotes" className="label-sm">
            ملاحظات
          </label>
          <Input
            id="supPayNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="اختياري"
          />
        </div>
        {mutation.isError && <p className="text-sm text-red-500">حدث خطأ.</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!amount || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'جاري التسجيل…' : 'تسجيل الدفع'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
