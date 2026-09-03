import { PERMISSION_GROUPS_AR } from '@grocery/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Loader2, Search, Square, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';

/**
 * PermissionsEditor — Phase 2 P2-6.
 *
 * The single most important admin component: lets store admins
 * curate the permission set on a role. Behaviour:
 *
 *   • Receives the canonical catalog (`groups`) — usually 17 modules.
 *   • Receives the current selection (`selected`) and emits a new
 *     selection via `onChange` whenever the user toggles a checkbox.
 *   • Top toolbar:
 *       - global counter "X / Y permission selected"
 *       - search field (matches Arabic name + technical code)
 *       - global "select all" / "clear all" pair
 *   • Each group:
 *       - module header with localized Arabic title + counter
 *       - per-group "select all in module" / "clear in module"
 *       - collapsible body with checkable rows (whole row is the click target)
 *   • Sticky footer (when `onSave` is provided):
 *       - dirty-state indicator (•)
 *       - "حفظ التغييرات" button (disabled when not dirty)
 *       - optional "إلغاء" reset
 *
 * Designed as a controlled component — parent owns the `selected` state.
 */

export interface PermissionItem {
  key: string;
  name: string;
  module: string;
  description?: string | null;
}

export interface PermissionGroup {
  module: string;
  permissions: PermissionItem[];
}

export interface PermissionsEditorProps {
  /** Catalog grouped by module. */
  groups: PermissionGroup[];
  /** Currently selected permission codes. */
  selected: string[];
  /** Fires whenever the selection changes. */
  onChange: (next: string[]) => void;
  /** Loading skeleton (catalog still loading). */
  isLoading?: boolean;
  /** Disable all interaction (e.g., during save). */
  disabled?: boolean;
  /** When provided, the sticky save footer is shown. */
  onSave?: () => void;
  /** Reset to baseline (used by the cancel button on the footer). */
  onCancel?: () => void;
  /** Reference selection used for the dirty indicator on the save footer. */
  baseline?: string[];
  /** Saving in progress (pulses the save button). */
  isSaving?: boolean;
  className?: string;
}

function arraysEqualUnordered(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const v of b) if (!setA.has(v)) return false;
  return true;
}

export function PermissionsEditor({
  groups,
  selected,
  onChange,
  isLoading,
  disabled,
  onSave,
  onCancel,
  baseline,
  isSaving,
  className,
}: PermissionsEditorProps): JSX.Element {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Filter groups by search term
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        permissions: g.permissions.filter(
          (p) => p.key.toLowerCase().includes(q) || p.name.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.permissions.length > 0);
  }, [groups, search]);

  const totalCount = useMemo(
    () => groups.reduce((acc, g) => acc + g.permissions.length, 0),
    [groups],
  );

  const isDirty = baseline ? !arraysEqualUnordered(selected, baseline) : false;

  const toggle = (code: string): void => {
    if (disabled) return;
    if (selectedSet.has(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  const toggleGroup = (group: PermissionGroup, allOn: boolean): void => {
    if (disabled) return;
    const codes = group.permissions.map((p) => p.key);
    if (allOn) {
      // remove all from selection
      onChange(selected.filter((c) => !codes.includes(c)));
    } else {
      // add all (dedupe via Set)
      const next = new Set(selected);
      for (const c of codes) next.add(c);
      onChange(Array.from(next));
    }
  };

  const selectAll = (): void => {
    if (disabled) return;
    onChange(groups.flatMap((g) => g.permissions.map((p) => p.key)));
  };

  const clearAll = (): void => {
    if (disabled) return;
    onChange([]);
  };

  // Auto-expand groups when there's a search hit
  useEffect(() => {
    if (search.trim()) setCollapsed({});
  }, [search]);

  if (isLoading) {
    return (
      <div className={cn('rounded-xl border border-gray-200 bg-surface p-5 space-y-4', className)}>
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* ─── Toolbar ─── */}
      <div className="rounded-xl border border-gray-200 bg-surface p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في الصلاحيات…"
              className="w-full h-9 ps-9 pe-3 rounded-lg border border-gray-200 bg-surface text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
              disabled={disabled}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-sm text-gray-600 tabular-nums"
            data-testid="permissions-editor-counter"
          >
            <span className="font-semibold text-ink">{selected.length}</span>
            <span className="text-gray-400"> / </span>
            <span className="text-gray-500">{totalCount}</span>
            <span className="ms-1 text-xs text-gray-400">صلاحية</span>
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={selectAll}
              disabled={disabled || selected.length === totalCount}
            >
              تحديد الكل
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={disabled || selected.length === 0}
            >
              إلغاء الكل
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Groups ─── */}
      {filteredGroups.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-surface">
          <EmptyState
            title="لا توجد نتائج"
            description={`لا تطابق صلاحيات هذا النص: «${search}»`}
          />
        </div>
      ) : (
        <div className="grid gap-4 desktop:grid-cols-2">
          <AnimatePresence initial={false}>
            {filteredGroups.map((group, idx) => {
              const groupSelected = group.permissions.filter((p) => selectedSet.has(p.key)).length;
              const groupTotal = group.permissions.length;
              const allOn = groupSelected === groupTotal;
              const someOn = groupSelected > 0 && !allOn;
              const isCollapsed = !!collapsed[group.module];
              const groupLabel = PERMISSION_GROUPS_AR[group.module] ?? group.module;

              return (
                <motion.section
                  key={group.module}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, delay: idx * 0.025 }}
                  className="rounded-xl border border-gray-200 bg-surface overflow-hidden"
                  data-testid={`permissions-group-${group.module}`}
                >
                  <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-surface-alt/60">
                    <button
                      type="button"
                      onClick={() => setCollapsed((c) => ({ ...c, [group.module]: !isCollapsed }))}
                      className="flex items-center gap-2 min-w-0 text-start"
                      aria-expanded={!isCollapsed}
                    >
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          'h-4 w-4 shrink-0 text-gray-400 transition-transform',
                          isCollapsed && '-rotate-90',
                        )}
                      />
                      <span className="font-semibold text-sm text-ink truncate">{groupLabel}</span>
                      <Badge
                        variant={allOn ? 'success' : someOn ? 'primary' : 'neutral'}
                        className="tabular-nums"
                      >
                        {groupSelected} / {groupTotal}
                      </Badge>
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'text-xs font-medium px-2 py-1 rounded-md transition-colors',
                        allOn
                          ? 'text-gray-600 hover:bg-gray-100'
                          : 'text-primary-700 hover:bg-primary-50',
                      )}
                      onClick={() => toggleGroup(group, allOn)}
                      disabled={disabled}
                    >
                      {allOn ? 'إلغاء الكل' : 'تحديد الكل'}
                    </button>
                  </header>

                  {!isCollapsed ? (
                    <ul className="divide-y divide-gray-100">
                      {group.permissions.map((p) => {
                        const checked = selectedSet.has(p.key);
                        return (
                          <li key={p.key}>
                            <label
                              className={cn(
                                'flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-primary-50/40 transition-colors',
                                disabled && 'cursor-not-allowed opacity-60',
                              )}
                            >
                              <span
                                aria-hidden
                                className={cn(
                                  'mt-0.5 grid place-items-center h-5 w-5 shrink-0 rounded-md border-2 transition-colors',
                                  checked
                                    ? 'bg-primary-600 border-primary-600 text-white'
                                    : 'border-gray-300 bg-surface',
                                )}
                              >
                                {checked ? <Check className="h-3.5 w-3.5" /> : null}
                              </span>
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={checked}
                                onChange={() => toggle(p.key)}
                                disabled={disabled}
                                aria-label={`${p.name} (${p.key})`}
                              />
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm text-ink">{p.name}</span>
                                <span className="block text-xs text-gray-400 font-mono mt-0.5 truncate">
                                  {p.key}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </motion.section>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ─── Sticky save footer ─── */}
      {onSave ? (
        <div
          className={cn(
            'sticky bottom-0 z-10 -mx-4 sm:mx-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-3',
            'rounded-none sm:rounded-xl border-t sm:border border-gray-200 bg-surface/90 backdrop-blur-sm shadow-card',
          )}
        >
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            {isDirty ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" aria-hidden />
                <span>تغييرات غير محفوظة</span>
              </>
            ) : (
              <>
                <Square className="h-3.5 w-3.5" aria-hidden />
                <span>لا توجد تغييرات</span>
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            {onCancel ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={!isDirty || isSaving || disabled}
                leftIcon={<X className="h-4 w-4" />}
              >
                تراجع
              </Button>
            ) : null}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onSave}
              disabled={!isDirty || isSaving || disabled}
              leftIcon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              {isSaving ? 'جاري الحفظ…' : 'حفظ التغييرات'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
