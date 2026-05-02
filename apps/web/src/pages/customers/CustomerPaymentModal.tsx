import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiPost } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
}

export function CustomerPaymentModal({
  open,
  onClose,
  customerId,
  customerName,
}: Props): JSX.Element {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      apiPost(`/api/v1/customers/${customerId}/transactions/payment`, {
        amount: Number(amount),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customers'] });
      setAmount('');
      setNotes('');
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={`تسديد دفعة — ${customerName}`} size="sm">
      <div className="space-y-4">
        <div>
          <label htmlFor="payAmount" className="label-sm">
            مبلغ الدفعة (ر.س) *
          </label>
          <Input
            id="payAmount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <label htmlFor="payNotes" className="label-sm">
            ملاحظات
          </label>
          <Input
            id="payNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="اختياري"
          />
        </div>
        {mutation.isError && <p className="text-sm text-red-500">حدث خطأ، حاول مرة أخرى.</p>}
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
            {mutation.isPending ? 'جاري التسجيل…' : 'تسجيل الدفعة'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
