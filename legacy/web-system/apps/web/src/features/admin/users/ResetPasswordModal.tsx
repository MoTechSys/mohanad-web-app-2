import { type ResetPasswordInput, resetPasswordSchema } from '@grocery/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import { ResponsiveDialog } from '@/components/ui/ResponsiveDialog';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { type UserDetail, resetUserPassword } from './api';

/**
 * ResetPasswordModal — admin password reset (Phase 2 P2-6).
 *
 * Two-step UX:
 *   1. Form for the new password + confirmation (with strength meter).
 *   2. After success, show the new password in a "copyable" panel as a
 *      one-time prompt for the admin to deliver it to the user; advise that
 *      all of the target user's sessions have been revoked.
 */
export interface ResetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  user: UserDetail | null;
}

const formSchema = resetPasswordSchema
  .extend({ confirmPassword: z.string() })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'كلمة المرور غير متطابقة',
  });
type FormShape = z.infer<typeof formSchema>;

export function ResetPasswordModal({ open, onClose, user }: ResetPasswordModalProps): JSX.Element {
  const toast = useToast();
  const qc = useQueryClient();
  const [showPwd, setShowPwd] = useState(false);
  const [savedPassword, setSavedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<FormShape>({
    resolver: zodResolver(formSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  // Reset state when modal opens
  useEffect(() => {
    if (!open) return;
    form.reset({ newPassword: '', confirmPassword: '' });
    setSavedPassword(null);
    setCopied(false);
    setShowPwd(false);
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: (body: ResetPasswordInput) => {
      if (!user) throw new Error('user is required for reset password');
      return resetUserPassword(user.id, body);
    },
    onSuccess: (res) => {
      toast.success('تم تغيير كلمة المرور');
      qc.invalidateQueries({ queryKey: ['admin', 'user', user?.id] });
      // Show the post-success panel (we already know the password; backend
      // doesn't echo it, by design).
      setSavedPassword(form.getValues('newPassword'));
      // Surface session-revocation count if any
      if (res.refreshTokensRevoked > 0) {
        toast.info(`تم إنهاء ${res.refreshTokensRevoked} جلسة نشطة لهذا المستخدم.`);
      }
    },
    onError: (err) => {
      toast.error(extractApiError(err).message ?? 'تعذر تغيير كلمة المرور');
    },
  });

  const passwordValue = form.watch('newPassword');

  const handleCopy = async () => {
    if (!savedPassword) return;
    try {
      await navigator.clipboard.writeText(savedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('تعذر النسخ — انسخ يدوياً.');
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={
        savedPassword ? 'كلمة المرور الجديدة' : `إعادة تعيين كلمة مرور: ${user?.fullName ?? ''}`
      }
      description={
        savedPassword
          ? 'انسخ كلمة المرور وسلّمها للمستخدم. لن يتم عرضها مرة أخرى.'
          : 'سيتم تسجيل خروج المستخدم من جميع الأجهزة فور الحفظ.'
      }
    >
      {savedPassword ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-4 flex items-center gap-3">
            <code
              className="font-mono text-base flex-1 text-ink select-all bg-surface rounded-md px-3 py-2 border border-primary-200/70"
              dir="ltr"
            >
              {savedPassword}
            </code>
            <Button
              type="button"
              variant={copied ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleCopy}
              leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            >
              {copied ? 'تم النسخ' : 'نسخ'}
            </Button>
          </div>
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <Button type="button" onClick={onClose}>
              إغلاق
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate({ newPassword: data.newPassword }))}
          className="flex flex-col gap-4"
        >
          <div
            className={cn(
              'flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800 text-sm',
            )}
          >
            <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" aria-hidden />
            <p>سيتم إلغاء كل جلسات المستخدم النشطة فور تغيير كلمة المرور — أبلغه قبل الحفظ.</p>
          </div>

          <div>
            <Input
              label="كلمة المرور الجديدة"
              required
              type={showPwd ? 'text' : 'password'}
              autoComplete="new-password"
              leftIcon={<KeyRound className="h-4 w-4" />}
              rightIcon={
                <button
                  type="button"
                  aria-label={showPwd ? 'إخفاء' : 'إظهار'}
                  className="text-gray-400 hover:text-ink"
                  onClick={() => setShowPwd((v) => !v)}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              errorText={form.formState.errors.newPassword?.message}
              {...form.register('newPassword')}
            />
            <PasswordStrengthMeter password={passwordValue ?? ''} className="mt-2" />
          </div>

          <Input
            label="تأكيد كلمة المرور"
            required
            type={showPwd ? 'text' : 'password'}
            autoComplete="new-password"
            leftIcon={<KeyRound className="h-4 w-4" />}
            errorText={form.formState.errors.confirmPassword?.message}
            {...form.register('confirmPassword')}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              إلغاء
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              تغيير كلمة المرور
            </Button>
          </div>
        </form>
      )}
    </ResponsiveDialog>
  );
}
