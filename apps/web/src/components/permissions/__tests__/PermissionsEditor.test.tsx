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
});
