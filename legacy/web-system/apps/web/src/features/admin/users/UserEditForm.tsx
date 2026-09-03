import { type UpdateUserInput, updateUserSchema } from '@grocery/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useUpdateUserMutation } from '@/features/admin/hooks';
import { extractApiError } from '@/lib/api';

interface EditableUser {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
}

interface Props {
  user: EditableUser;
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserEditForm({ user, onSuccess, onCancel }: Props): JSX.Element {
  const toast = useToast();
  const update = useUpdateUserMutation(user.id);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      fullName: user.fullName,
      phone: user.phone ?? undefined,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await update.mutateAsync({
        ...values,
        phone: values.phone ? values.phone : undefined,
      });
      toast.success('تم تحديث بيانات المستخدم');
      onSuccess();
    } catch (err) {
      const apiErr = extractApiError(err);
      setServerError(apiErr.message ?? 'فشل تحديث المستخدم');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input
        label="اسم المستخدم"
        value={user.username}
        readOnly
        helperText="لا يمكن تغيير اسم المستخدم بعد الإنشاء"
        dir="ltr"
        className="bg-gray-50"
      />
      <Input
        label="الاسم الكامل"
        required
        errorText={errors.fullName?.message}
        {...register('fullName')}
      />
      <Input
        label="رقم الهاتف"
        dir="ltr"
        placeholder="+9677XXXXXXXX"
        errorText={errors.phone?.message}
        {...register('phone')}
      />

      {serverError ? (
        <p className="text-sm text-danger bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {serverError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          إلغاء
        </Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting || update.isPending}>
          حفظ التغييرات
        </Button>
      </div>
    </form>
  );
}
