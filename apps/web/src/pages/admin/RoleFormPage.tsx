import {
  type CreateRoleInput,
  type UpdateRoleInput,
  createRoleSchema,
  updateRoleSchema,
} from '@grocery/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { ArrowRight, Save, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Redirect, useHistory, useLocation, useParams } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionsEditor } from '@/components/permissions/PermissionsEditor';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import {
  useCreateRoleMutation,
  usePermissionsCatalogQuery,
  useRoleDetailQuery,
  useSetRolePermissionsMutation,
  useUpdateRoleMutation,
} from '@/features/admin/hooks';
import { extractApiError } from '@/lib/api';

interface CloneState {
  cloneFrom?: string;
}

export function RoleFormPage(): JSX.Element {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id && id !== 'new');
  const history = useHistory();
  const location = useLocation<CloneState | undefined>();
  const toast = useToast();

  const cloneFromId = !isEdit ? location.state?.cloneFrom : undefined;
  const cloneSourceQ = useRoleDetailQuery(cloneFromId);

  const roleQ = useRoleDetailQuery(isEdit ? id : undefined);
  const catalogQ = usePermissionsCatalogQuery();

  const create = useCreateRoleMutation();
  const updateMeta = useUpdateRoleMutation(isEdit ? (id as string) : '');
  const setPerms = useSetRolePermissionsMutation(isEdit ? (id as string) : '');

  // Local permission editor state (separate from RHF — too dynamic for it)
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [baselinePerms, setBaselinePerms] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // ─── RHF setup ───
  const editForm = useForm<UpdateRoleInput>({
    resolver: zodResolver(updateRoleSchema),
    defaultValues: { name: '', description: '' },
  });
  const createForm = useForm<CreateRoleInput>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: { key: '', name: '', description: '', permissionCodes: [] },
  });

  // ─── Hydration: edit (load role) / clone (load source) ───
  useEffect(() => {
    if (hydrated) return;
    if (isEdit) {
      const r = roleQ.data;
      if (!r) return;
      editForm.reset({
        name: r.name,
        description: r.description ?? '',
      });
      const baseline = r.permissions.map((p) => p.key);
      setSelectedPerms(baseline);
      setBaselinePerms(baseline);
      setHydrated(true);
    } else if (cloneFromId) {
      const src = cloneSourceQ.data;
      if (!src) return;
      createForm.reset({
        key: '',
        name: `${src.name} (نسخة)`,
        description: src.description ?? '',
        permissionCodes: src.permissions.map((p) => p.key),
      });
      const baseline = src.permissions.map((p) => p.key);
      setSelectedPerms(baseline);
      setBaselinePerms([]); // baseline empty → everything is "dirty" so save is enabled
      setHydrated(true);
    } else {
      // fresh create
      setHydrated(true);
    }
  }, [hydrated, isEdit, roleQ.data, cloneFromId, cloneSourceQ.data, editForm, createForm]);

  // 404 if invalid id
  if (isEdit && roleQ.error) {
    toast.error('لم يتم العثور على الدور');
    return <Redirect to="/admin/roles" />;
  }

  const role = isEdit ? roleQ.data : null;
  const isSystemRole = Boolean(role?.isSystem);
  const groups = catalogQ.data?.groups ?? [];

  // ─── Submit handlers ───
  const onSubmitEdit = editForm.handleSubmit(async (values) => {
    if (!role) return;
    try {
      // 1. update meta (system roles can only update description, but the
      //    backend enforces this — front sends what changed)
      await updateMeta.mutateAsync({
        name: isSystemRole ? undefined : values.name,
        description: values.description ?? null,
      });
      // 2. set permissions (when changed)
      const dirty =
        new Set(selectedPerms).size !== new Set(baselinePerms).size ||
        selectedPerms.some((c) => !baselinePerms.includes(c));
      if (dirty) {
        await setPerms.mutateAsync(selectedPerms);
        setBaselinePerms(selectedPerms);
      }
      toast.success('تم حفظ الدور');
    } catch (err) {
      const e = extractApiError(err);
      toast.error(e.message ?? 'فشل حفظ الدور');
    }
  });

  const onSubmitCreate = createForm.handleSubmit(async (values) => {
    try {
      const created = await create.mutateAsync({
        ...values,
        permissionCodes: selectedPerms,
      });
      toast.success(`تم إنشاء الدور «${created.name}»`);
      history.replace(`/admin/roles/${created.id}`);
    } catch (err) {
      const e = extractApiError(err);
      toast.error(e.message ?? 'فشل إنشاء الدور');
    }
  });

  const breadcrumbs = useMemo(
    () => [
      { label: 'الإدارة' },
      { label: 'الأدوار', to: '/admin/roles' },
      { label: isEdit ? (role?.name ?? '...') : cloneFromId ? 'نسخ دور' : 'دور جديد' },
    ],
    [isEdit, role?.name, cloneFromId],
  );

  const isSaving = updateMeta.isPending || setPerms.isPending || create.isPending;

  if (
    (isEdit && roleQ.isLoading) ||
    catalogQ.isLoading ||
    (cloneFromId && cloneSourceQ.isLoading)
  ) {
    return (
      <AppShell title="دور">
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={isEdit ? 'تعديل الدور' : 'دور جديد'} withBack onBack={() => history.goBack()}>
      <div className="max-w-6xl mx-auto px-4 py-6 desktop:py-8 space-y-6">
        <Breadcrumbs items={breadcrumbs} />
        <PageHeader
          eyebrow={isSystemRole ? 'دور نظامي' : isEdit ? 'تعديل دور' : 'إنشاء دور'}
          title={
            isEdit ? (role?.name ?? 'تعديل الدور') : cloneFromId ? 'نسخ دور موجود' : 'دور جديد'
          }
          description={
            isSystemRole
              ? 'لا يمكن تغيير اسم أو مفتاح هذا الدور — يمكنك تعديل الوصف وقائمة الصلاحيات فقط.'
              : 'حدّد المعلومات الأساسية ثم اختر الصلاحيات.'
          }
          actions={
            <Button
              variant="ghost"
              leftIcon={<ArrowRight className="h-4 w-4" />}
              onClick={() => history.push('/admin/roles')}
            >
              العودة
            </Button>
          }
        />

        {isSystemRole ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3"
          >
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
            <div className="text-sm text-amber-900">
              <p className="font-semibold mb-0.5">دور نظامي محمي</p>
              <p>
                تم إنشاؤه تلقائياً من الـ seed. الاسم والمفتاح ثابتان، ويمكنك تعديل الوصف وضبط
                صلاحياته بحسب احتياج متجرك.
              </p>
            </div>
          </motion.div>
        ) : null}

        {/* ─── Step 1: Basic info ─── */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <span>المعلومات الأساسية</span>
              {isSystemRole ? (
                <Badge variant="primary" icon={<ShieldCheck className="h-3 w-3" />}>
                  نظامي
                </Badge>
              ) : null}
            </div>
          }
        >
          {isEdit ? (
            <form onSubmit={onSubmitEdit} className="grid gap-4 sm:grid-cols-2">
              <Input
                label="اسم الدور"
                required
                readOnly={isSystemRole}
                helperText={isSystemRole ? 'مغلق على الأدوار النظامية' : undefined}
                errorText={editForm.formState.errors.name?.message}
                {...editForm.register('name')}
              />
              <Input
                label="مفتاح الدور"
                value={role?.key ?? ''}
                readOnly
                dir="ltr"
                className="bg-gray-50"
              />
              <div className="sm:col-span-2">
                <label
                  htmlFor="role-description-edit"
                  className="block text-sm font-medium text-ink mb-1.5"
                >
                  الوصف
                </label>
                <textarea
                  id="role-description-edit"
                  rows={2}
                  placeholder="وصف موجز للدور…"
                  className="w-full rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                  {...editForm.register('description')}
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  leftIcon={<Save className="h-4 w-4" />}
                  isLoading={updateMeta.isPending}
                >
                  حفظ المعلومات
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={onSubmitCreate} className="grid gap-4 sm:grid-cols-2">
              <Input
                label="اسم الدور"
                required
                placeholder="مثل: مسؤول المشتريات"
                errorText={createForm.formState.errors.name?.message}
                {...createForm.register('name')}
              />
              <Input
                label="مفتاح الدور"
                required
                placeholder="purchasing_manager"
                dir="ltr"
                helperText="حروف صغيرة وأرقام و - _ فقط"
                errorText={createForm.formState.errors.key?.message}
                {...createForm.register('key')}
              />
              <div className="sm:col-span-2">
                <label
                  htmlFor="role-description-create"
                  className="block text-sm font-medium text-ink mb-1.5"
                >
                  الوصف
                </label>
                <textarea
                  id="role-description-create"
                  rows={2}
                  placeholder="وصف موجز للدور…"
                  className="w-full rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                  {...createForm.register('description')}
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => history.push('/admin/roles')}>
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  leftIcon={<Save className="h-4 w-4" />}
                  isLoading={create.isPending}
                  disabled={selectedPerms.length === 0}
                >
                  إنشاء الدور
                </Button>
              </div>
            </form>
          )}
        </Card>

        {/* ─── Step 2: Permissions editor ─── */}
        <section className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold text-ink">الصلاحيات</h2>
            <span className="text-xs text-gray-400">
              ({groups.length} مجموعة · {catalogQ.data?.total ?? 0} صلاحية إجمالاً)
            </span>
          </div>
          <PermissionsEditor
            groups={groups}
            selected={selectedPerms}
            baseline={isEdit ? baselinePerms : undefined}
            onChange={setSelectedPerms}
            isLoading={catalogQ.isLoading}
            onSave={isEdit ? () => void onSubmitEdit() : undefined}
            onCancel={
              isEdit
                ? () => {
                    setSelectedPerms(baselinePerms);
                  }
                : undefined
            }
            isSaving={isSaving}
          />
        </section>
      </div>
    </AppShell>
  );
}
