import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  KeyRound,
  Lock,
  Pencil,
  Phone,
  Shield,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
  UserCog,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ResetPasswordModal } from '../../features/admin/users/ResetPasswordModal';
import { UserFormModal } from '../../features/admin/users/UserFormModal';
import {
  activateUser,
  deactivateUser,
  deleteUser,
  getEffectivePermissions,
  getUser,
} from '../../features/admin/users/api';

dayjs.extend(relativeTime);
dayjs.locale('ar');

/**
 * UserDetailPage — admin detail view for a single user (Phase 2 P2-6).
 *
 *   • Profile card (avatar, name, status, last login, phone, created at).
 *   • Roles section (badges, with system-role indicator).
 *   • Effective-permissions section (sourced from
 *     /users/:id/effective-permissions, grouped by module).
 *   • Activate / Deactivate / Reset password / Delete actions
 *     (each gated by the matching permission + the system-role / self-action
 *     safety rules).
 */
export function UserDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const toast = useToast();
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const userQuery = useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => getUser(id),
    enabled: Boolean(id),
  });

  const permsQuery = useQuery({
    queryKey: ['admin', 'user', id, 'effective-permissions'],
    queryFn: () => getEffectivePermissions(id),
    enabled: Boolean(id),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const activateMut = useMutation({
    mutationFn: () => activateUser(id),
    onSuccess: () => {
      toast.success('تم تفعيل المستخدم');
      qc.invalidateQueries({ queryKey: ['admin', 'user', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setConfirmToggle(false);
    },
    onError: (e) => toast.error(extractApiError(e).message ?? 'تعذر تفعيل المستخدم'),
  });

  const deactivateMut = useMutation({
    mutationFn: () => deactivateUser(id),
    onSuccess: (res) => {
      toast.success('تم تعطيل المستخدم');
      if (res.refreshTokensRevoked > 0)
        toast.info(`تم إنهاء ${res.refreshTokensRevoked} جلسة نشطة.`);
      qc.invalidateQueries({ queryKey: ['admin', 'user', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setConfirmToggle(false);
    },
    onError: (e) => toast.error(extractApiError(e).message ?? 'تعذر تعطيل المستخدم'),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteUser(id),
    onSuccess: () => {
      toast.success('تم حذف المستخدم');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      history.push('/admin/users');
    },
    onError: (e) => toast.error(extractApiError(e).message ?? 'تعذر حذف المستخدم'),
  });

  const user = userQuery.data;
  const permissions = permsQuery.data?.permissions ?? [];

  // Group permissions by module for the chip grid below
  const groupedPermissions = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const code of permissions) {
      const [module] = code.split('.');
      const key = module ?? 'unknown';
      const arr = map.get(key) ?? [];
      arr.push(code);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);

  const isSelf = currentUser?.id === user?.id;
  const hasOwnerRole = (user?.roles ?? []).some((r) => r.key === 'Owner');
  const cannotDelete = isSelf || hasOwnerRole;

  if (userQuery.isLoading) {
    return (
      <AppShell title="تفاصيل المستخدم">
        <div className="px-4 py-4 desktop:px-8 desktop:py-8 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title="تفاصيل المستخدم">
        <div className="px-4 py-4 desktop:px-8 desktop:py-8">
          <EmptyState
            icon={AlertTriangle}
            title="المستخدم غير موجود"
            description="ربما تم حذف المستخدم أو أن المعرّف غير صحيح."
            action={
              <Button onClick={() => history.push('/admin/users')}>العودة لقائمة المستخدمين</Button>
            }
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={user.fullName}>
      <div className="px-4 py-4 desktop:px-8 desktop:py-8 space-y-5">
        <Breadcrumbs
          items={[
            { label: 'الإدارة', to: '/admin/users' },
            { label: 'المستخدمون', to: '/admin/users' },
            { label: user.fullName },
          ]}
        />

        <PageHeader
          eyebrow="مستخدم"
          title={user.fullName}
          description={
            <span className="font-mono text-xs" dir="ltr">
              @{user.username}
            </span>
          }
          actions={
            <div className="flex items-center gap-2">
              <PermissionGate permission="users.update">
                <Button
                  variant="secondary"
                  onClick={() => setEditOpen(true)}
                  leftIcon={<Pencil className="h-4 w-4" />}
                >
                  تعديل
                </Button>
              </PermissionGate>
              <PermissionGate permission="users.reset_password">
                <Button
                  variant="secondary"
                  onClick={() => setResetOpen(true)}
                  leftIcon={<KeyRound className="h-4 w-4" />}
                >
                  إعادة تعيين كلمة المرور
                </Button>
              </PermissionGate>
            </div>
          }
        />

        {/* Profile card */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
            <Avatar name={user.fullName} size="lg" className="!h-16 !w-16 !text-xl" />
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ProfileField
                label="الاسم الكامل"
                value={user.fullName}
                icon={<UserCog className="h-4 w-4" />}
              />
              <ProfileField
                label="اسم المستخدم"
                value={
                  <span className="font-mono" dir="ltr">
                    @{user.username}
                  </span>
                }
                icon={<UserCog className="h-4 w-4" />}
              />
              <ProfileField
                label="رقم الهاتف"
                value={user.phone || '—'}
                icon={<Phone className="h-4 w-4" />}
              />
              <ProfileField
                label="الحالة"
                value={
                  user.isActive ? (
                    <Badge variant="success" icon={<UserCheck className="h-3 w-3" />}>
                      نشط
                    </Badge>
                  ) : (
                    <Badge variant="danger" icon={<Lock className="h-3 w-3" />}>
                      معطل
                    </Badge>
                  )
                }
                icon={<Activity className="h-4 w-4" />}
              />
              <ProfileField
                label="آخر دخول"
                value={user.lastLoginAt ? dayjs(user.lastLoginAt).fromNow() : 'لم يسجل دخول'}
                icon={<CalendarClock className="h-4 w-4" />}
              />
              <ProfileField
                label="تاريخ الإنشاء"
                value={dayjs(user.createdAt).format('YYYY-MM-DD')}
                icon={<CalendarClock className="h-4 w-4" />}
              />
            </div>
          </div>
        </Card>

        {/* Roles */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary-600" />
              الأدوار المعيّنة
            </div>
          }
        >
          {user.roles.length === 0 ? (
            <p className="text-sm text-gray-500">لا توجد أدوار معيّنة لهذا المستخدم.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {user.roles.map((r) => (
                <Badge
                  key={r.id}
                  variant="primary"
                  className="!text-sm !px-2.5 !py-1"
                  icon={<Shield className="h-3.5 w-3.5" />}
                >
                  {r.name}
                  {r.isSystem ? (
                    <span className="ms-1.5 inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-1.5 py-0 text-[10px] font-semibold">
                      نظامي
                    </span>
                  ) : null}
                </Badge>
              ))}
            </div>
          )}
        </Card>

        {/* Effective permissions */}
        <Card
          header={
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary-600" />
                الصلاحيات الفعلية
              </span>
              <span className="text-xs text-gray-500 font-mono tabular-nums">
                {permissions.length}
              </span>
            </div>
          }
        >
          {permsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : permissions.length === 0 ? (
            <p className="text-sm text-gray-500">لا توجد صلاحيات (يحتاج تعيين دور).</p>
          ) : (
            <div className="space-y-3">
              {groupedPermissions.map(([module, codes]) => (
                <div key={module}>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    {module}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {codes.map((c) => (
                      <Badge key={c} variant="primary" className="font-mono">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity (placeholder) */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-400" />
              آخر النشاطات
            </div>
          }
        >
          <p className="text-sm text-gray-500">
            سيتم عرض سجل نشاطات المستخدم هنا في مرحلة قادمة (Audit Logs).
          </p>
        </Card>

        {/* Danger zone */}
        <Card
          header={
            <span className="text-red-600 font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> منطقة الإجراءات الخطرة
            </span>
          }
          className="border-red-200"
        >
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">
                {user.isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {user.isActive
                  ? 'تعطيل الحساب يلغي جميع الجلسات النشطة فوراً ويمنع الدخول.'
                  : 'سيتمكن المستخدم من تسجيل الدخول مجدداً بكلمة مروره الحالية.'}
              </p>
            </div>
            {user.isActive ? (
              <PermissionGate permission="users.deactivate">
                <Button
                  variant="danger"
                  onClick={() => setConfirmToggle(true)}
                  leftIcon={<ShieldOff className="h-4 w-4" />}
                  disabled={isSelf}
                  title={isSelf ? 'لا يمكنك تعطيل حسابك الخاص' : undefined}
                >
                  تعطيل
                </Button>
              </PermissionGate>
            ) : (
              <PermissionGate permission="users.activate">
                <Button
                  variant="primary"
                  onClick={() => activateMut.mutate()}
                  leftIcon={<UserCheck className="h-4 w-4" />}
                  isLoading={activateMut.isPending}
                >
                  تفعيل
                </Button>
              </PermissionGate>
            )}
          </div>

          <div className="my-4 border-t border-red-100" />

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">حذف الحساب</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {cannotDelete
                  ? isSelf
                    ? 'لا يمكنك حذف حسابك الخاص.'
                    : 'لا يمكن حذف حساب يحمل دور Owner.'
                  : 'حذف ناعم — يمكن استرجاع البيانات لاحقاً.'}
              </p>
            </div>
            <PermissionGate permission="users.delete">
              <Button
                variant="danger"
                onClick={() => setConfirmDelete(true)}
                leftIcon={<Trash2 className="h-4 w-4" />}
                disabled={cannotDelete}
              >
                حذف
              </Button>
            </PermissionGate>
          </div>
        </Card>
      </div>

      {/* Modals */}
      <UserFormModal
        open={editOpen}
        user={user}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['admin', 'user', id] });
          qc.invalidateQueries({ queryKey: ['admin', 'users'] });
        }}
      />
      <ResetPasswordModal open={resetOpen} user={user} onClose={() => setResetOpen(false)} />

      <ConfirmDialog
        open={confirmToggle}
        title={user.isActive ? 'تعطيل المستخدم' : 'تفعيل المستخدم'}
        message={
          user.isActive ? (
            <span>
              هل أنت متأكد من تعطيل <strong>{user.fullName}</strong>؟ سيتم تسجيل خروجه من جميع
              الأجهزة فوراً.
            </span>
          ) : (
            <span>
              هل تريد إعادة تفعيل حساب <strong>{user.fullName}</strong>؟
            </span>
          )
        }
        confirmLabel={user.isActive ? 'تعطيل' : 'تفعيل'}
        intent={user.isActive ? 'danger' : 'primary'}
        isLoading={user.isActive ? deactivateMut.isPending : activateMut.isPending}
        onConfirm={() => (user.isActive ? deactivateMut.mutate() : activateMut.mutate())}
        onClose={() => setConfirmToggle(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="حذف المستخدم"
        message={
          <span>
            سيتم حذف <strong>{user.fullName}</strong> (حذف ناعم). لا يمكن التراجع من الواجهة.
          </span>
        }
        confirmLabel="حذف"
        intent="danger"
        isLoading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
        onClose={() => setConfirmDelete(false)}
      />
    </AppShell>
  );
}

interface ProfileFieldProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

function ProfileField({ label, value, icon }: ProfileFieldProps): JSX.Element {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-0.5 flex items-center gap-1">
        {icon ? <span className="text-gray-400">{icon}</span> : null}
        {label}
      </p>
      <div className="text-sm text-ink">{value}</div>
    </div>
  );
}
