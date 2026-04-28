import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Lock,
  MoreVertical,
  Pencil,
  PlusCircle,
  Search,
  ShieldOff,
  UserCheck,
  UserPlus,
  Users as UsersIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AppShell } from '@/components/layout/AppShell';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionGate } from '@/components/permissions/PermissionGate';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { type Column, DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { extractApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { listRolesNormalized } from '../../features/admin/roles/api';
import { ResetPasswordModal } from '../../features/admin/users/ResetPasswordModal';
import { UserFormModal } from '../../features/admin/users/UserFormModal';
import {
  type UserListItem,
  activateUser,
  deactivateUser,
  listUsers,
} from '../../features/admin/users/api';

dayjs.extend(relativeTime);
dayjs.locale('ar');

const PAGE_SIZE = 20;

/**
 * UsersListPage — Phase 2 P2-6 admin landing for users.
 *
 *   • TanStack Query for data + cache invalidation.
 *   • Search (debounced) + role filter + isActive filter + pagination.
 *   • Per-row actions (gated by permission): edit · reset password ·
 *     activate / deactivate.
 *   • Click on a row → /admin/users/:id detail page.
 */
export function UsersListPage(): JSX.Element {
  const toast = useToast();
  const qc = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [roleId, setRoleId] = useState<string | ''>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Debounce the search input → reset page when search changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', { search, page, roleId, activeFilter }],
    queryFn: () =>
      listUsers({
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
        roleId: roleId || undefined,
        isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
      }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const rolesQuery = useQuery({
    queryKey: ['admin', 'roles', 'catalog'],
    queryFn: listRolesNormalized,
    staleTime: 60_000,
  });

  // ─── Modals state ────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserListItem | null>(null);
  const [resetUser, setResetUser] = useState<UserListItem | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<UserListItem | null>(null);

  // ─── Mutations ───────────────────────────────────────────────
  const activateMut = useMutation({
    mutationFn: (id: string) => activateUser(id),
    onSuccess: () => {
      toast.success('تم تفعيل المستخدم');
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (e) => toast.error(extractApiError(e).message ?? 'تعذر تفعيل المستخدم'),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: (res) => {
      toast.success('تم تعطيل المستخدم');
      if (res.refreshTokensRevoked > 0)
        toast.info(`تم إنهاء ${res.refreshTokensRevoked} جلسة نشطة.`);
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setConfirmDeactivate(null);
    },
    onError: (e) => toast.error(extractApiError(e).message ?? 'تعذر تعطيل المستخدم'),
  });

  // ─── Computed ────────────────────────────────────────────────
  const meta = usersQuery.data?.meta;
  // API only returns `{page, limit, total}`; derive `totalPages` here.
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / Math.max(1, meta.limit))) : 1;
  const items = usersQuery.data?.items ?? [];

  const columns: Column<UserListItem>[] = useMemo(
    () => [
      {
        key: 'user',
        header: 'المستخدم',
        render: (row) => (
          <Link to={`/admin/users/${row.id}`} className="flex items-center gap-3 group">
            <Avatar name={row.fullName} size="md" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink group-hover:text-primary-700 truncate">
                {row.fullName}
              </div>
              <div className="text-xs text-gray-500 font-mono" dir="ltr">
                @{row.username}
              </div>
            </div>
          </Link>
        ),
      },
      {
        key: 'roles',
        header: 'الأدوار',
        render: (row) => (
          <div className="flex flex-wrap gap-1.5">
            {row.roles.length === 0 ? (
              <span className="text-xs text-gray-400">—</span>
            ) : (
              row.roles.map((r) => (
                <Badge key={r.id} variant="primary">
                  {r.name}
                </Badge>
              ))
            )}
          </div>
        ),
      },
      {
        key: 'status',
        header: 'الحالة',
        render: (row) =>
          row.isActive ? (
            <Badge variant="success" icon={<UserCheck className="h-3 w-3" />}>
              نشط
            </Badge>
          ) : (
            <Badge variant="danger" icon={<Lock className="h-3 w-3" />}>
              معطل
            </Badge>
          ),
      },
      {
        key: 'lastLogin',
        header: 'آخر دخول',
        render: (row) =>
          row.lastLoginAt ? (
            <span className="text-xs text-gray-600" title={row.lastLoginAt}>
              {dayjs(row.lastLoginAt).fromNow()}
            </span>
          ) : (
            <span className="text-xs text-gray-400">لم يسجل دخول</span>
          ),
      },
      {
        key: 'actions',
        header: '',
        render: (row) => (
          <div className="flex items-center gap-1 justify-end">
            <PermissionGate permission="users.update">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setEditUser(row);
                }}
                aria-label="تعديل"
                leftIcon={<Pencil className="h-3.5 w-3.5" />}
              >
                تعديل
              </Button>
            </PermissionGate>
            <PermissionGate permission="users.reset_password">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setResetUser(row);
                }}
                aria-label="إعادة تعيين كلمة المرور"
                leftIcon={<KeyRound className="h-3.5 w-3.5" />}
              >
                كلمة المرور
              </Button>
            </PermissionGate>
            {row.isActive ? (
              <PermissionGate permission="users.deactivate">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setConfirmDeactivate(row);
                  }}
                  aria-label="تعطيل"
                  leftIcon={<ShieldOff className="h-3.5 w-3.5" />}
                  className="text-red-600 hover:text-red-700"
                >
                  تعطيل
                </Button>
              </PermissionGate>
            ) : (
              <PermissionGate permission="users.activate">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    activateMut.mutate(row.id);
                  }}
                  aria-label="تفعيل"
                  leftIcon={<UserCheck className="h-3.5 w-3.5" />}
                  className="text-emerald-700 hover:text-emerald-800"
                >
                  تفعيل
                </Button>
              </PermissionGate>
            )}
          </div>
        ),
      },
    ],
    [activateMut],
  );

  const isLoading = usersQuery.isLoading;

  return (
    <AppShell title="المستخدمون">
      <div className="px-4 py-4 desktop:px-8 desktop:py-8 space-y-5">
        <Breadcrumbs items={[{ label: 'الإدارة', to: '/admin/users' }, { label: 'المستخدمون' }]} />

        <PageHeader
          eyebrow="إدارة"
          title="المستخدمون"
          description="إدارة فريق العمل: إنشاء حسابات، تعيين أدوار، ومراقبة الحالة."
          actions={
            <PermissionGate permission="users.create">
              <Button
                onClick={() => setCreateOpen(true)}
                leftIcon={<PlusCircle className="h-4 w-4" />}
              >
                إضافة مستخدم
              </Button>
            </PermissionGate>
          }
        />

        {/* Filters bar */}
        <Card className="!p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="search"
              placeholder="ابحث بالاسم أو اسم المستخدم أو الهاتف…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
              className="flex-1"
            />
            <select
              value={roleId}
              onChange={(e) => {
                setRoleId(e.target.value);
                setPage(1);
              }}
              className="h-11 rounded-lg border border-gray-200 bg-surface px-3 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none min-w-[160px]"
            >
              <option value="">كل الأدوار</option>
              {rolesQuery.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value as typeof activeFilter);
                setPage(1);
              }}
              className="h-11 rounded-lg border border-gray-200 bg-surface px-3 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none min-w-[140px]"
            >
              <option value="all">كل الحالات</option>
              <option value="active">نشط فقط</option>
              <option value="inactive">معطل فقط</option>
            </select>
          </div>
        </Card>

        {/* Table or empty state */}
        {!isLoading && items.length === 0 && !search && !roleId && activeFilter === 'all' ? (
          <EmptyState
            icon={UsersIcon}
            title="لا يوجد مستخدمون بعد"
            description="ابدأ بإضافة أول مستخدم لفريقك."
            action={
              <PermissionGate permission="users.create">
                <Button
                  onClick={() => setCreateOpen(true)}
                  leftIcon={<UserPlus className="h-4 w-4" />}
                >
                  إضافة مستخدم
                </Button>
              </PermissionGate>
            }
          />
        ) : (
          <DataTable
            rows={items}
            columns={columns}
            rowKey={(r) => r.id}
            isLoading={isLoading}
            emptyTitle="لا توجد نتائج مطابقة"
            emptyDescription="جرّب تعديل البحث أو الفلاتر."
          />
        )}

        {/* Pagination */}
        {meta && meta.total > 0 ? (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div>
              <span className="font-mono tabular-nums">{meta.total}</span> مستخدم
              {meta.total > PAGE_SIZE ? (
                <>
                  {' '}
                  · الصفحة <span className="font-mono tabular-nums">{meta.page}</span> /{' '}
                  <span className="font-mono tabular-nums">{totalPages}</span>
                </>
              ) : null}
            </div>
            {totalPages > 1 ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  leftIcon={<ChevronRight className="h-4 w-4" />}
                >
                  السابق
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages || isLoading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  rightIcon={<ChevronLeft className="h-4 w-4" />}
                >
                  التالي
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Loading skeletons (alongside placeholderData) */}
        {isLoading && items.length === 0 ? (
          <div className="space-y-2 mt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : null}
      </div>

      {/* Modals */}
      <UserFormModal open={createOpen} onClose={() => setCreateOpen(false)} user={null} />
      <UserFormModal
        open={Boolean(editUser)}
        user={(editUser as never) ?? null}
        onClose={() => setEditUser(null)}
      />
      <ResetPasswordModal
        open={Boolean(resetUser)}
        user={(resetUser as never) ?? null}
        onClose={() => setResetUser(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmDeactivate)}
        title="تعطيل المستخدم"
        message={
          <span>
            هل أنت متأكد من تعطيل <strong>{confirmDeactivate?.fullName}</strong>؟
            <br />
            <span className="text-xs text-gray-500">
              سيتم تسجيل خروجه من جميع الأجهزة فوراً ولن يستطيع الدخول مجدداً حتى التفعيل.
            </span>
          </span>
        }
        confirmLabel="تعطيل"
        intent="danger"
        isLoading={deactivateMut.isPending}
        onConfirm={() => confirmDeactivate && deactivateMut.mutate(confirmDeactivate.id)}
        onClose={() => setConfirmDeactivate(null)}
      />

      {/* Hidden cn() use guard so the bundler keeps it tree-shakeable */}
      <span className={cn('sr-only')} aria-hidden />
    </AppShell>
  );
}
