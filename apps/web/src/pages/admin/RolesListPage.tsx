import { motion } from 'framer-motion';
import {
  Copy,
  Eye,
  Pencil,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  Users as UsersIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useHistory } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import type { RoleListItem } from '@/features/admin/api';
import { useDeleteRoleMutation, useRolesListQuery } from '@/features/admin/hooks';
import { extractApiError } from '@/lib/api';
import { cn } from '@/lib/cn';

export function RolesListPage(): JSX.Element {
  const history = useHistory();
  const toast = useToast();
  const rolesQ = useRolesListQuery();
  const remove = useDeleteRoleMutation();
  const [confirmDelete, setConfirmDelete] = useState<RoleListItem | null>(null);

  const handleClone = (role: RoleListItem): void => {
    // Forward to the new-role page with prefill state
    history.push({
      pathname: '/admin/roles/new',
      state: { cloneFrom: role.id },
    });
  };

  return (
    <AppShell title="الأدوار">
      <div className="max-w-6xl mx-auto px-4 py-6 desktop:py-8 space-y-6">
        <Breadcrumbs items={[{ label: 'الإدارة' }, { label: 'الأدوار' }]} />
        <PageHeader
          eyebrow="P2-6 · RBAC"
          title="الأدوار والصلاحيات"
          description="حدد ما يستطيع كل فريق فعله. الأدوار النظامية محمية من الحذف."
          actions={
            <PermissionGate permission="roles.create">
              <Button
                variant="primary"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => history.push('/admin/roles/new')}
              >
                إنشاء دور
              </Button>
            </PermissionGate>
          }
        />

        {rolesQ.isLoading ? (
          <div className="grid gap-4 desktop:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
              <Skeleton key={i} className="h-44 w-full" />
            ))}
          </div>
        ) : (rolesQ.data?.length ?? 0) === 0 ? (
          <Card>
            <EmptyState
              title="لا توجد أدوار بعد"
              description="ابدأ بإنشاء أول دور لتحديد صلاحيات فريقك."
              icon={Shield}
            />
          </Card>
        ) : (
          <div className="grid gap-4 desktop:grid-cols-3">
            {rolesQ.data?.map((role, idx) => (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * idx }}
              >
                <Card interactive className="h-full">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-ink truncate">{role.name}</h3>
                        {role.isSystem ? (
                          <Badge
                            variant="primary"
                            icon={<ShieldCheck className="h-3 w-3" />}
                            className="shrink-0"
                          >
                            نظامي
                          </Badge>
                        ) : null}
                      </div>
                      <p
                        dir="ltr"
                        className="text-[11px] text-gray-400 font-mono truncate"
                        title={role.key}
                      >
                        {role.key}
                      </p>
                    </div>
                  </div>

                  <p
                    className={cn(
                      'text-sm text-gray-600 line-clamp-2 min-h-[2.5em]',
                      !role.description && 'italic text-gray-400',
                    )}
                  >
                    {role.description || 'لا يوجد وصف'}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Shield className="h-3.5 w-3.5 text-primary-500" aria-hidden />
                      <span>
                        <span className="font-semibold text-ink tabular-nums">
                          {role.permissionsCount ?? 0}
                        </span>{' '}
                        صلاحية
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <UsersIcon className="h-3.5 w-3.5 text-primary-500" aria-hidden />
                      <span>
                        <span className="font-semibold text-ink tabular-nums">
                          {role.usersCount ?? 0}
                        </span>{' '}
                        مستخدم
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 pt-2 border-t border-gray-100">
                    <Link
                      to={`/admin/roles/${role.id}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-600 hover:bg-gray-100 hover:text-ink transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" /> عرض
                    </Link>
                    <PermissionGate permission="roles.update">
                      <Link
                        to={`/admin/roles/${role.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-primary-700 hover:bg-primary-50 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" /> تعديل
                      </Link>
                    </PermissionGate>
                    <PermissionGate permission="roles.clone">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-600 hover:bg-gray-100 hover:text-ink transition-colors"
                        onClick={() => handleClone(role)}
                      >
                        <Copy className="h-3.5 w-3.5" /> نسخ
                      </button>
                    </PermissionGate>
                    {!role.isSystem ? (
                      <PermissionGate permission="roles.delete">
                        <button
                          type="button"
                          className="ms-auto inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-600 hover:bg-red-50 transition-colors"
                          onClick={() => setConfirmDelete(role)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> حذف
                        </button>
                      </PermissionGate>
                    ) : null}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Delete confirm ─── */}
      {confirmDelete ? (
        <ConfirmDialog
          open
          title="حذف الدور"
          message={
            <>
              هل أنت متأكد من حذف الدور <strong>«{confirmDelete.name}»</strong>؟
              {(confirmDelete.usersCount ?? 0) > 0 ? (
                <>
                  <br />
                  <span className="text-amber-700 mt-2 inline-block">
                    تنبيه: هذا الدور مُسنَد إلى {confirmDelete.usersCount} مستخدم. سيتم إزالته منهم.
                  </span>
                </>
              ) : null}
            </>
          }
          confirmLabel="حذف"
          intent="danger"
          isLoading={remove.isPending}
          onClose={() => setConfirmDelete(null)}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(confirmDelete.id);
              toast.success('تم حذف الدور');
              setConfirmDelete(null);
            } catch (err) {
              const e = extractApiError(err);
              toast.error(e.message ?? 'فشل حذف الدور');
            }
          }}
        />
      ) : null}
    </AppShell>
  );
}
