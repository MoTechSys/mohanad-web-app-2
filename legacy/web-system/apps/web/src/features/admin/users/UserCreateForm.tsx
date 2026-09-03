import { type CreateUserInput, createUserSchema } from '@grocery/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import { useToast } from '@/components/ui/Toast';
import type { RoleListItem } from '@/features/admin/api';
import { useCreateUserMutation } from '@/features/admin/hooks';
import { extractApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Props {
  roles: RoleListItem[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserCreateForm({ roles, onSuccess, onCancel }: Props): JSX.Element {
  const toast = useToast();
  const create = useCreateUserMutation();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: '',
      password: '',
      fullName: '',
      phone: '',
      isActive: true,
      roleIds: [],
    },
  });

  const password = watch('password') ?? '';

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const cleaned: CreateUserInput = {
        ...values,
        // strip empty optional phone (Zod allows undefined)
        phone: values.phone ? values.phone : undefined,
      };
      const created = await create.mutateAsync(cleaned);
      toast.success(`تم إنشاء المستخدم «${created.fullName}»`);
      onSuccess();
    } catch (err) {
      const apiErr = extractApiError(err);
      setServerError(apiErr.message ?? 'فشل إنشاء المستخدم');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="الاسم الكامل"
          required
          placeholder="مثل: محمد أحمد"
          errorText={errors.fullName?.message}
          {...register('fullName')}
        />
        <Input
          label="اسم المستخدم"
          required
          placeholder="user123"
          dir="ltr"
          errorText={errors.username?.message}
          {...register('username')}
        />
      </div>

      <Input
        label="رقم الهاتف"
        placeholder="+9677XXXXXXXX"
        dir="ltr"
        errorText={errors.phone?.message}
        {...register('phone')}
      />

      <div>
        <Input
          type="password"
          label="كلمة المرور"
          required
          placeholder="٨ أحرف على الأقل"
          errorText={errors.password?.message}
          {...register('password')}
        />
        <div className="mt-2">
          <PasswordStrengthMeter password={password} />
        </div>
      </div>

      <Controller
        control={control}
        name="roleIds"
        render={({ field, fieldState }) => (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">
              الأدوار <span className="text-danger">*</span>
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 p-2 bg-surface-alt/40">
              {roles.length === 0 ? (
                <p className="text-xs text-gray-500 px-2 py-3">لا توجد أدوار متاحة بعد</p>
              ) : null}
              {roles.map((role) => {
                const checked = field.value.includes(role.id);
                return (
                  <label
                    key={role.id}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-primary-50/60 transition-colors',
                      checked && 'bg-primary-50',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) field.onChange([...field.value, role.id]);
                        else field.onChange(field.value.filter((v: string) => v !== role.id));
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-ink">{role.name}</span>
                    {role.isSystem ? (
                      <span className="text-[10px] text-gray-400">نظامي</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
            {fieldState.error ? (
              <p className="text-xs text-danger">{fieldState.error.message}</p>
            ) : null}
          </fieldset>
        )}
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
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting || create.isPending}
          leftIcon={
            isSubmitting || create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null
          }
        >
          إنشاء المستخدم
        </Button>
      </div>
    </form>
  );
}
