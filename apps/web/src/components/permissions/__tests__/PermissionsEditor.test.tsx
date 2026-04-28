import {
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type PermissionGroup, PermissionsEditor } from '../PermissionsEditor';

const groups: PermissionGroup[] = [
  {
    module: 'users',
    permissions: [
      { key: 'users.view', name: 'عرض المستخدمين', module: 'users' },
      { key: 'users.create', name: 'إنشاء مستخدم', module: 'users' },
      { key: 'users.update', name: 'تعديل مستخدم', module: 'users' },
    ],
  },
  {
    module: 'roles',
    permissions: [
      { key: 'roles.view', name: 'عرض الأدوار', module: 'roles' },
      { key: 'roles.create', name: 'إنشاء دور', module: 'roles' },
    ],
  },
];

describe('<PermissionsEditor />', () => {
  it('renders the global counter (selected / total) and one section per module', () => {
    render(<PermissionsEditor groups={groups} selected={['users.view']} onChange={() => {}} />);
    const counter = screen.getByTestId('permissions-editor-counter');
    expect(counter).toHaveTextContent('1');
    expect(counter).toHaveTextContent('5'); // total
    expect(screen.getByTestId('permissions-group-users')).toBeInTheDocument();
    expect(screen.getByTestId('permissions-group-roles')).toBeInTheDocument();
    expect(screen.getByText('المستخدمون')).toBeInTheDocument();
    expect(screen.getByText('الأدوار والصلاحيات')).toBeInTheDocument();
  });

  it('toggles a single permission via the row label', () => {
    const onChange = vi.fn();
    render(<PermissionsEditor groups={groups} selected={[]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('عرض المستخدمين (users.view)'));
    expect(onChange).toHaveBeenCalledWith(['users.view']);
  });

  it('selects all permissions in a group via the per-group toggle', () => {
    const onChange = vi.fn();
    render(<PermissionsEditor groups={groups} selected={[]} onChange={onChange} />);
    const usersGroup = screen.getByTestId('permissions-group-users');
    const groupBtn = within(usersGroup).getByRole('button', { name: 'تحديد الكل' });
    fireEvent.click(groupBtn);
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining(['users.view', 'users.create', 'users.update']),
    );
  });

  it('clears all selections via the global "إلغاء الكل" button', () => {
    const onChange = vi.fn();
    render(
      <PermissionsEditor
        groups={groups}
        selected={['users.view', 'roles.view']}
        onChange={onChange}
      />,
    );
    const allClears = screen.getAllByRole('button', { name: 'إلغاء الكل' });
    // The first one is in the global toolbar.
    const firstClear = allClears[0];
    if (firstClear) fireEvent.click(firstClear);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('filters groups by search term and shows the empty state for no matches', async () => {
    render(<PermissionsEditor groups={groups} selected={[]} onChange={() => {}} />);
    const search = screen.getByPlaceholderText('ابحث في الصلاحيات…');
    // No permission key/name contains "zzz" — should clear out both groups.
    fireEvent.change(search, { target: { value: 'zzz_no_match' } });
    expect(await screen.findByText('لا توجد نتائج')).toBeInTheDocument();
  });

  it('filters groups by search term and keeps only matching groups', async () => {
    render(<PermissionsEditor groups={groups} selected={[]} onChange={() => {}} />);
    const search = screen.getByPlaceholderText('ابحث في الصلاحيات…');
    // The technical key prefix "roles." is unique to the roles group.
    fireEvent.change(search, { target: { value: 'roles.' } });
    // <AnimatePresence> keeps exiting sections in the DOM until the exit
    // animation finishes (~180ms) — wait for them to be removed.
    await waitForElementToBeRemoved(() => screen.queryByTestId('permissions-group-users'), {
      timeout: 1000,
    });
    expect(screen.getByTestId('permissions-group-roles')).toBeInTheDocument();
  });

  it('shows the sticky save footer with dirty indicator and calls onSave', () => {
    const onSave = vi.fn();
    render(
      <PermissionsEditor
        groups={groups}
        selected={['users.view']}
        baseline={[]}
        onChange={() => {}}
        onSave={onSave}
      />,
    );
    expect(screen.getByText('تغييرات غير محفوظة')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'حفظ التغييرات' }));
    expect(onSave).toHaveBeenCalled();
  });

  it('disables the save button when not dirty (baseline matches selection)', () => {
    render(
      <PermissionsEditor
        groups={groups}
        selected={['users.view']}
        baseline={['users.view']}
        onChange={() => {}}
        onSave={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'حفظ التغييرات' })).toBeDisabled();
    expect(screen.getByText('لا توجد تغييرات')).toBeInTheDocument();
  });

  it('matches search by permission CODE (e.g. "users.create")', async () => {
    render(<PermissionsEditor groups={groups} selected={[]} onChange={() => {}} />);
    const search = screen.getByPlaceholderText('ابحث في الصلاحيات…');
    fireEvent.change(search, { target: { value: 'users.create' } });
    // <AnimatePresence> keeps exiting sections until the exit animation
    // finishes. Wait for the non-matching group to be removed.
    await waitForElementToBeRemoved(() => screen.queryByTestId('permissions-group-roles'), {
      timeout: 1000,
    });
    const usersGroup = within(screen.getByTestId('permissions-group-users'));
    expect(usersGroup.getByText('users.create')).toBeInTheDocument();
    expect(usersGroup.queryByText('users.view')).not.toBeInTheDocument();
  });

  it('global "تحديد الكل" selects every permission across every module', () => {
    const onChange = vi.fn();
    render(<PermissionsEditor groups={groups} selected={[]} onChange={onChange} />);
    // The 1st "تحديد الكل" button is the GLOBAL one in the toolbar.
    const allBtns = screen.getAllByRole('button', { name: 'تحديد الكل' });
    const firstBtn = allBtns[0];
    if (!firstBtn) throw new Error('no "تحديد الكل" button rendered');
    fireEvent.click(firstBtn);
    expect(onChange).toHaveBeenCalledTimes(1);
    const codes = onChange.mock.calls[0]?.[0] as string[];
    expect(codes).toEqual(
      expect.arrayContaining([
        'users.view',
        'users.create',
        'users.update',
        'roles.view',
        'roles.create',
      ]),
    );
    expect(codes.length).toBe(5);
  });

  it('per-group "إلغاء الكل" only clears that module, not others', () => {
    const onChange = vi.fn();
    render(
      <PermissionsEditor
        groups={groups}
        // All 3 users permissions selected → users group toggle shows
        // "إلغاء الكل" (all-on state).
        selected={['users.view', 'users.create', 'users.update', 'roles.view']}
        onChange={onChange}
      />,
    );
    const usersGroup = within(screen.getByTestId('permissions-group-users'));
    fireEvent.click(usersGroup.getByRole('button', { name: 'إلغاء الكل' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]?.[0] as string[];
    expect(next).not.toContain('users.view');
    expect(next).not.toContain('users.create');
    expect(next).not.toContain('users.update');
    expect(next).toContain('roles.view'); // untouched
  });
});
