import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { apiPost } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateProductModal({ open, onClose }: Props): JSX.Element {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    barcode: '',
    unit: 'حبة',
    purchasePrice: '',
    salePrice: '',
    minQuantity: '',
    trackInventory: true,
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({
      ...f,
      [k]: k === 'trackInventory' ? (e.target as HTMLInputElement).checked : e.target.value,
    }));

  const mutation = useMutation({
    mutationFn: () =>
      apiPost('/api/v1/products', {
        name: form.name,
        barcode: form.barcode || undefined,
        unit: form.unit || 'حبة',
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : 0,
        salePrice: form.salePrice ? Number(form.salePrice) : 0,
        minQuantity: form.minQuantity ? Number(form.minQuantity) : 0,
        trackInventory: form.trackInventory,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] });
      setForm({
        name: '',
        barcode: '',
        unit: 'حبة',
        purchasePrice: '',
        salePrice: '',
        minQuantity: '',
        trackInventory: true,
      });
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="إضافة منتج جديد" size="md">
      <div className="space-y-4">
        <div>
          <label htmlFor="prodName" className="label-sm">
            اسم المنتج *
          </label>
          <Input id="prodName" value={form.name} onChange={set('name')} placeholder="اسم المنتج" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="prodBarcode" className="label-sm">
              الباركود
            </label>
            <Input
              id="prodBarcode"
              value={form.barcode}
              onChange={set('barcode')}
              placeholder="XXXXXXXXXX"
            />
          </div>
          <div>
            <label htmlFor="prodUnit" className="label-sm">
              وحدة القياس
            </label>
            <Input
              id="prodUnit"
              value={form.unit}
              onChange={set('unit')}
              placeholder="حبة، كيلو، لتر…"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="prodBuy" className="label-sm">
              سعر الشراء (ر.س)
            </label>
            <Input
              id="prodBuy"
              type="number"
              value={form.purchasePrice}
              onChange={set('purchasePrice')}
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor="prodSell" className="label-sm">
              سعر البيع (ر.س)
            </label>
            <Input
              id="prodSell"
              type="number"
              value={form.salePrice}
              onChange={set('salePrice')}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="prodMin" className="label-sm">
              الحد الأدنى للمخزون
            </label>
            <Input
              id="prodMin"
              type="number"
              value={form.minQuantity}
              onChange={set('minQuantity')}
              placeholder="0"
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input
              id="prodTrack"
              type="checkbox"
              checked={form.trackInventory}
              onChange={set('trackInventory')}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="prodTrack" className="text-sm text-gray-700">
              تتبع المخزون
            </label>
          </div>
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
            {mutation.isPending ? 'جاري الحفظ…' : 'حفظ المنتج'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
