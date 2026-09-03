import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import { useToast } from '@/components/ui/Toast';
import { useResetPasswordMutation } from '@/features/admin/hooks';
import { extractApiError } from '@/lib/api';

const resetSchema = z
  .object({
    newPassword: z.string().min(8, 'كلمة المرور ≥ 8 أحرف').max(72),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'كلمتا المرور غير متطابقتين',
    path: ['confirmPassword'],
  });

type ResetForm = z.infer<typeof resetSchema>;

interface Props {
  userId: string;
  username: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ResetPasswordForm({ userId, username, onSuccess, onCancel }: Props): JSX.Element {
  const toast = useToast();
  const reset = useResetPasswordMutation(userId);
  const [serverError, setServerError] = useState<string | null>(null);
  const [completedPassword, setCompletedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const newPassword = watch('newPassword');

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await reset.mutateAsync(values.newPassword);
      setCompletedPassword(values.newPassword);
      toast.success('تم تغيير كلمة المرور — تم تسجيل خروج المستخدم من جميع الأجهزة');
    } catch (err) {
      const apiErr = extractApiError(err);
      setServerError(apiErr.message ?? 'فشل تغيير كلمة المرور');
    }
  });

  const handleCopy = async (): Promise<void> => {
    if (!completedPassword) return;
    try {
      await navigator.clipboard.writeText(completedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('تعذر النسخ — انسخ يدوياً');
    }
  };

  // ─── Success view: show new password for copy ───
  if (completedPassword) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          تم إعادة تعيين كلمة المرور للمستخدم{' '}
          <span dir="ltr" className="font-mono text-ink">
            {username}
          </span>
          . انسخها وأعطها له بشكل آمن — لن نعرضها مرة أخرى.
        </p>
        <div className="flex items-stretch gap-2">
          <code
            dir="ltr"
            className="flex-1 select-all px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm font-mono text-emerald-800 break-all"
          >
            {completedPassword}
          </code>
          <Button
            type="button"
            variant="secondary"
            onClick={handleCopy}
            leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          >
            {copied ? 'تم النسخ' : 'نسخ'}
          </Button>
        </div>
        <div className="flex justify-end pt-2">
          <Button type="button" variant="primary" onClick={onSuccess}>
            تم
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        إعادة تعيين كلمة المرور للمستخدم{' '}
        <span dir="ltr" className="font-mono text-ink">
          {username}
        </span>
        . سيتم تسجيل خروجه من جميع الأجهزة فور الحفظ.
      </p>

      <div>
        <Input
          type="password"
          label="كلمة المرور الجديدة"
          required
          errorText={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <div className="mt-2">
          <PasswordStrengthMeter password={newPassword ?? ''} />
        </div>
      </div>

      <Input
        type="password"
        label="تأكيد كلمة المرور"
        required
        errorText={errors.confirmPassword?.message}
        {...register('confirmPassword')}
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
        <Button type="submit" variant="danger" isLoading={isSubmitting || reset.isPending}>
          إعادة التعيين
        </Button>
      </div>
    </form>
  );
}
