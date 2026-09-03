import {
  type CreateUserInput,
  type UpdateUserInput,
  createUserSchema,
  updateUserSchema,
} from '@grocery/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, KeyRound, Phone, Shield, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import { ResponsiveDialog } from '@/components/ui/ResponsiveDialog';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { type RoleSummary, listRolesNormalized } from '../roles/api';
import { type UserDetail, createUser, updateUser } from './api';

/**
 * UserFormModal — create + edit modal for users (Phase 2 P2-6).
 *
 * Drives both flows:
 *   • mode="create" — POST /users (full form incl. password + roles)
 *   • mode="edit"   — PATCH /users/:id (no password, username read-only)
 *
 * Uses RHF + Zod validation (shared schemas) and React Query for the
 * roles catalog (needed for the role multi-select).
 */
export interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the modal is in edit mode and pre-fills fields. */
  user?: UserDetail | null;
  /** Optional callback after successful save (e.g. close + refresh detail). */
  onSaved?: (user: UserDetail) => void;
}

/** Extends the shared `createUserSchema` with a `confirmPassword` matcher. */
const createUserFormSchema = createUserSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'كلمة المرور غير متطابقة',
  });

type CreateFormShape = z.infer<typeof createUserFormSchema>;

export function UserFormModal({ open, onClose, user, onSaved }: UserFormModalProps): JSX.Element {
  const isEdit = Boolean(user);
  const toast = useToast();
  const qc = useQueryClient();
  const [showPwd, setShowPwd] = useState(false);

  const rolesQuery = useQuery({
    queryKey: ['admin', 'roles', 'catalog'],
    queryFn: listRolesNormalized,
    enabled: open,
    staleTime: 60_000,
  });

  // ─── Create form ────────────────────────────────────────────
  const createForm = useForm<CreateFormShape>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      username: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      phone: '',
      isActive: true,
      roleIds: [],
    },
  });

  // ─── Edit form ──────────────────────────────────────────────
  const editForm = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      fullName: user?.fullName ?? '',
      phone: user?.phone ?? '',
      isActive: user?.isActive ?? true,
    },
  });

  // Reset forms when modal opens or user changes
  useEffect(() => {
    if (!open) return;
    if (isEdit && user) {
      editForm.reset({
        fullName: user.fullName,
        phone: user.phone ?? '',
        isActive: user.isActive,
      });
    } else {
      createForm.reset({
        username: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        phone: '',
        isActive: true,
        roleIds: [],
      });
    }
    setShowPwd(false);
  }, [open, user, isEdit, createForm, editForm]);

  const createMut = useMutation({
    mutationFn: (body: CreateUserInput) => createUser(body),
    onSuccess: (saved) => {
      toast.success('تم إنشاء المستخدم');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      onSaved?.(saved);
      onClose();
    },
    onError: (err) => {
      const apiErr = extractApiError(err);
      toast.error(apiErr.message ?? 'تعذر إنشاء المستخدم');
    },
  });

  const updateMut = useMutation({
    mutationFn: (body: UpdateUserInput) => {
      if (!user) throw new Error('user is required for update');
      return updateUser(user.id, body);
    },
    onSuccess: (saved) => {
      toast.success('تم حفظ التغييرات');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      if (user) qc.invalidateQueries({ queryKey: ['admin', 'user', user.id] });
      onSaved?.(saved);
      onClose();
    },
    onError: (err) => {
      const apiErr = extractApiError(err);
      toast.error(apiErr.message ?? 'تعذر حفظ التغييرات');
    },
  });

  const submitting = createMut.isPending || updateMut.isPending;
  const passwordValue = createForm.watch('password');

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={isEdit ? `تعديل: ${user?.fullName ?? ''}` : 'إضافة مستخدم جديد'}
      description={
        isEdit
          ? 'تعديل بيانات المستخدم. لتغيير كلمة المرور استخدم زر «إعادة تعيين كلمة المرور».'
          : 'أنشئ مستخدماً جديداً وعيّن له دوراً واحداً على الأقل.'
      }
      size="lg"
    >
      {isEdit ? (
        <form
          onSubmit={editForm.handleSubmit((data) => updateMut.mutate(data))}
          className="flex flex-col gap-4"
        >
          {/* Read-only username */}
          <Input
            label="اسم المستخدم"
            value={user?.username ?? ''}
            readOnly
            disabled
            leftIcon={<User className="h-4 w-4" />}
            helperText="لا يمكن تغيير اسم المستخدم بعد الإنشاء."
          />
          <Input
            label="الاسم الكامل"
            required
            errorText={editForm.formState.errors.fullName?.message}
            {...editForm.register('fullName')}
          />
          <Input
            label="رقم الهاتف"
            placeholder="مثال: 967700000000"
            leftIcon={<Phone className="h-4 w-4" />}
            errorText={editForm.formState.errors.phone?.message}
            {...editForm.register('phone')}
          />

          <FooterActions onClose={onClose} submitting={submitting} submitLabel="حفظ التغييرات" />
        </form>
      ) : (
        <form
          onSubmit={createForm.handleSubmit((data) => {
            const { confirmPassword: _drop, ...payload } = data;
            createMut.mutate(payload as CreateUserInput);
          })}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="الاسم الكامل"
              required
              leftIcon={<User className="h-4 w-4" />}
              errorText={createForm.formState.errors.fullName?.message}
              {...createForm.register('fullName')}
            />
            <Input
              label="اسم المستخدم"
              required
              placeholder="ahmed"
              autoComplete="off"
              autoCapitalize="off"
              dir="ltr"
              leftIcon={<User className="h-4 w-4" />}
              errorText={createForm.formState.errors.username?.message}
              {...createForm.register('username')}
            />
          </div>

          <Input
            label="رقم الهاتف"
            placeholder="مثال: 967700000000"
            leftIcon={<Phone className="h-4 w-4" />}
            errorText={createForm.formState.errors.phone?.message}
            {...createForm.register('phone')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Input
                label="كلمة المرور"
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
                errorText={createForm.formState.errors.password?.message}
                {...createForm.register('password')}
              />
              <PasswordStrengthMeter password={passwordValue ?? ''} className="mt-2" />
            </div>
            <Input
              label="تأكيد كلمة المرور"
              required
              type={showPwd ? 'text' : 'password'}
              autoComplete="new-password"
              leftIcon={<KeyRound className="h-4 w-4" />}
              errorText={createForm.formState.errors.confirmPassword?.message}
              {...createForm.register('confirmPassword')}
            />
          </div>

          {/* Role multi-select */}
          <Controller
            name="roleIds"
            control={createForm.control}
            render={({ field, fieldState }) => (
              <RoleMultiSelect
                value={field.value ?? []}
                onChange={field.onChange}
                roles={rolesQuery.data ?? []}
                isLoading={rolesQuery.isLoading}
                error={fieldState.error?.message}
              />
            )}
          />

          <FooterActions onClose={onClose} submitting={submitting} submitLabel="إنشاء المستخدم" />
        </form>
      )}
    </ResponsiveDialog>
  );
}

function FooterActions({
  onClose,
  submitting,
  submitLabel,
}: {
  onClose: () => void;
  submitting: boolean;
  submitLabel: string;
}): JSX.Element {
  return (
    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
      <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
        إلغاء
      </Button>
      <Button type="submit" isLoading={submitting}>
        {submitLabel}
      </Button>
    </div>
  );
}

interface RoleMultiSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
  roles: RoleSummary[];
  isLoading?: boolean;
  error?: string;
}

function RoleMultiSelect({
  value,
  onChange,
  roles,
  isLoading,
  error,
}: RoleMultiSelectProps): JSX.Element {
  const selected = useMemo(() => new Set(value), [value]);
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">
        الأدوار <span className="text-danger">*</span>
      </span>
      <div
        className={cn(
          'rounded-lg border bg-surface p-2 flex flex-wrap gap-2 min-h-[44px]',
          error ? 'border-danger' : 'border-gray-200',
        )}
      >
        {isLoading ? (
          <span className="text-sm text-gray-400 px-2 py-1">جاري التحميل…</span>
        ) : roles.length === 0 ? (
          <span className="text-sm text-gray-400 px-2 py-1">لا توجد أدوار</span>
        ) : (
          roles.map((r) => {
            const on = selected.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggle(r.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                  on
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                    : 'bg-surface text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-700',
                )}
              >
                <Shield className="h-3.5 w-3.5" aria-hidden />
                {r.name}
                {r.isSystem ? (
                  <Badge
                    variant={on ? 'neutral' : 'primary'}
                    className={cn('text-[10px] px-1.5 py-0', on && 'bg-white/20 text-white')}
                  >
                    نظامي
                  </Badge>
                ) : null}
              </button>
            );
          })
        )}
      </div>
      {error ? <p className="text-xs text-danger mt-0.5">{error}</p> : null}
      <p className="text-xs text-gray-400">يمكن اختيار أكثر من دور.</p>
    </div>
  );
}
